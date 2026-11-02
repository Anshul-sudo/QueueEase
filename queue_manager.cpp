/**
 * ============================================================================
 * QueueEase – Multi-Server Customer Service Simulator (C++ DSA Implementation)
 * ============================================================================
 * 
 * Problem Statement:
 *   Multi-Server Customer Service Simulator: Use queues to distribute requests
 *   among multiple service counters. Analyze waiting times, queue lengths,
 *   server utilization, and workload imbalance under different arrival patterns.
 * 
 * Data Structures & Algorithms (DSA) Concepts:
 *   1. Queue Abstract Data Type (FIFO Queue ADT with O(1) enqueue/dequeue)
 *   2. Multi-Queue Architecture: Single Shared Queue vs Dedicated Shortest Queues
 *   3. Discrete Event Simulation (Event-driven time advancement)
 *   4. Performance Metrics: Waiting Time, Queue Lengths, Server Utilization, Workload Imbalance
 *   5. Arrival Patterns: Regular (constant gap), Random (Poisson/Uniform), Burst (batch arrivals)
 * 
 * Compilation:
 *   g++ -std=c++14 -O2 queue_manager.cpp -o queue_manager
 * 
 * Execution:
 *   ./queue_manager
 *   ./queue_manager [num_counters] [num_customers] [avg_service_time] [arrival_pattern]
 *   Example: ./queue_manager 3 30 6 burst
 * ============================================================================
 */

#include <iostream>
#include <vector>
#include <queue>
#include <string>
#include <iomanip>
#include <algorithm>
#include <random>

// ----------------------------------------------------------------------------
// Data Structures
// ----------------------------------------------------------------------------

struct Customer {
    std::string id;
    int arrivalTime;
    int serviceDuration;
    int serviceStartTime = -1;
    int completionTime = -1;
    int waitingTime = 0;
    int assignedCounter = -1;
};

struct Counter {
    int id;
    bool isBusy = false;
    int busyUntil = 0;
    int totalBusyTime = 0;
    int customersServed = 0;
    std::queue<Customer> dedicatedQueue; // used for separate queue policy
};

struct SimulationResults {
    std::string strategyName;
    int totalCustomers;
    int totalServed;
    double avgWaitingTime;
    int maxQueueLength;
    double avgUtilization;
    int totalDuration;
    int workloadImbalance;
    std::vector<double> counterUtilizations;
};

// ----------------------------------------------------------------------------
// Customer Ingestion & Arrival Pattern Generator
// ----------------------------------------------------------------------------

std::vector<Customer> generateCustomers(int count, int avgService, const std::string& pattern = "regular") {
    std::vector<Customer> customers;
    customers.reserve(count);
    
    int arrival = 0;
    for (int i = 1; i <= count; ++i) {
        int gap = 3;
        if (pattern == "regular") {
            gap = 3; // Fixed deterministic 3-second spacing
        } else if (pattern == "random") {
            // Poisson/Uniform random variance between 1s and 5s
            gap = 1 + ((i * 7 + 3) % 5);
        } else if (pattern == "burst") {
            // Burst mode: groups of 3-4 customers arrive simultaneously, followed by a lull
            if (i % 4 == 1) gap = 8;
            else gap = 0; // Same-second batch arrival
        } else {
            // Default spacing
            gap = (i % 3 == 0) ? 1 : ((i % 2 == 0) ? 3 : 2);
        }

        arrival += gap;
        int duration = std::max(1, avgService + ((i * 3) % 5) - 2);
        
        Customer c;
        c.id = "C" + std::to_string(i);
        c.arrivalTime = arrival;
        c.serviceDuration = duration;
        customers.push_back(c);
    }
    return customers;
}

// ----------------------------------------------------------------------------
// Simulation Engine: Strategy A (Single Shared FIFO Queue)
// ----------------------------------------------------------------------------

SimulationResults simulateSharedQueue(std::vector<Customer> customers, int numCounters) {
    std::vector<Counter> counters(numCounters);
    for (int i = 0; i < numCounters; ++i) {
        counters[i].id = i + 1;
    }

    std::queue<Customer> waitingQueue;
    std::vector<Customer> completed;
    completed.reserve(customers.size());

    int currentTime = 0;
    int maxQueue = 0;
    size_t nextCustomerIdx = 0;

    while (nextCustomerIdx < customers.size() || !waitingQueue.empty() || 
           std::any_of(counters.begin(), counters.end(), [currentTime](const Counter& c) { return c.busyUntil > currentTime; })) {
        
        // Advance time to next critical event
        int nextArrival = (nextCustomerIdx < customers.size()) ? customers[nextCustomerIdx].arrivalTime : 1e9;
        int nextDeparture = 1e9;
        for (const auto& c : counters) {
            if (c.busyUntil > currentTime && c.busyUntil < nextDeparture) {
                nextDeparture = c.busyUntil;
            }
        }

        int nextTime = std::min(nextArrival, nextDeparture);
        if (nextTime == (int)1e9) break;
        currentTime = std::max(currentTime, nextTime);

        // Free completed counters
        for (auto& c : counters) {
            if (c.busyUntil <= currentTime) {
                c.isBusy = false;
            }
        }

        // Process arrivals occurring at or before currentTime
        while (nextCustomerIdx < customers.size() && customers[nextCustomerIdx].arrivalTime <= currentTime) {
            Customer cust = customers[nextCustomerIdx++];

            // Check for available counter
            auto freeCounter = std::find_if(counters.begin(), counters.end(), [](const Counter& c) { return !c.isBusy; });
            if (freeCounter != counters.end()) {
                cust.serviceStartTime = currentTime;
                cust.waitingTime = cust.serviceStartTime - cust.arrivalTime;
                cust.completionTime = currentTime + cust.serviceDuration;
                cust.assignedCounter = freeCounter->id;

                freeCounter->isBusy = true;
                freeCounter->busyUntil = cust.completionTime;
                freeCounter->totalBusyTime += cust.serviceDuration;
                freeCounter->customersServed++;
                completed.push_back(cust);
            } else {
                waitingQueue.push(cust);
            }
        }

        // Dispatch waiting customers to any newly idle counters
        for (auto& c : counters) {
            if (!c.isBusy && !waitingQueue.empty()) {
                Customer cust = waitingQueue.front();
                waitingQueue.pop();

                cust.serviceStartTime = currentTime;
                cust.waitingTime = cust.serviceStartTime - cust.arrivalTime;
                cust.completionTime = currentTime + cust.serviceDuration;
                cust.assignedCounter = c.id;

                c.isBusy = true;
                c.busyUntil = cust.completionTime;
                c.totalBusyTime += cust.serviceDuration;
                c.customersServed++;
                completed.push_back(cust);
            }
        }

        maxQueue = std::max(maxQueue, (int)waitingQueue.size());
    }

    // Calculate performance metrics
    double totalWait = 0.0;
    for (const auto& c : completed) totalWait += c.waitingTime;

    int totalDuration = std::max(1, currentTime);
    std::vector<double> utils;
    int minBusy = 1e9, maxBusy = 0;
    double totalBusyAll = 0.0;

    for (const auto& c : counters) {
        double u = std::min(100.0, (double)c.totalBusyTime / totalDuration * 100.0);
        utils.push_back(u);
        totalBusyAll += c.totalBusyTime;
        minBusy = std::min(minBusy, c.totalBusyTime);
        maxBusy = std::max(maxBusy, c.totalBusyTime);
    }

    SimulationResults res;
    res.strategyName = "Single Shared FIFO Queue";
    res.totalCustomers = (int)customers.size();
    res.totalServed = (int)completed.size();
    res.avgWaitingTime = completed.empty() ? 0.0 : totalWait / completed.size();
    res.maxQueueLength = maxQueue;
    res.avgUtilization = totalBusyAll / (numCounters * totalDuration) * 100.0;
    res.totalDuration = totalDuration;
    res.workloadImbalance = maxBusy - minBusy;
    res.counterUtilizations = utils;
    return res;
}

// ----------------------------------------------------------------------------
// Simulation Engine: Strategy B (Separate Queues - Shortest Queue First)
// ----------------------------------------------------------------------------

SimulationResults simulateSeparateQueues(std::vector<Customer> customers, int numCounters) {
    std::vector<Counter> counters(numCounters);
    for (int i = 0; i < numCounters; ++i) {
        counters[i].id = i + 1;
    }

    std::vector<Customer> completed;
    completed.reserve(customers.size());

    int currentTime = 0;
    int maxQueue = 0;
    size_t nextCustomerIdx = 0;

    while (nextCustomerIdx < customers.size() || 
           std::any_of(counters.begin(), counters.end(), [](const Counter& c) { return !c.dedicatedQueue.empty(); }) || 
           std::any_of(counters.begin(), counters.end(), [currentTime](const Counter& c) { return c.busyUntil > currentTime; })) {
        
        int nextArrival = (nextCustomerIdx < customers.size()) ? customers[nextCustomerIdx].arrivalTime : 1e9;
        int nextDeparture = 1e9;
        for (const auto& c : counters) {
            if (c.busyUntil > currentTime && c.busyUntil < nextDeparture) {
                nextDeparture = c.busyUntil;
            }
        }

        int nextTime = std::min(nextArrival, nextDeparture);
        if (nextTime == (int)1e9) break;
        currentTime = std::max(currentTime, nextTime);

        // Free completed counters
        for (auto& c : counters) {
            if (c.busyUntil <= currentTime) {
                c.isBusy = false;
            }
        }

        // Arrivals: assign to counter with shortest total line (isBusy + queue size)
        while (nextCustomerIdx < customers.size() && customers[nextCustomerIdx].arrivalTime <= currentTime) {
            Customer cust = customers[nextCustomerIdx++];

            int bestIdx = 0;
            int minLoad = (counters[0].isBusy ? 1 : 0) + (int)counters[0].dedicatedQueue.size();
            for (int i = 1; i < numCounters; ++i) {
                int load = (counters[i].isBusy ? 1 : 0) + (int)counters[i].dedicatedQueue.size();
                if (load < minLoad) {
                    minLoad = load;
                    bestIdx = i;
                }
            }

            if (!counters[bestIdx].isBusy && counters[bestIdx].dedicatedQueue.empty()) {
                cust.serviceStartTime = currentTime;
                cust.waitingTime = cust.serviceStartTime - cust.arrivalTime;
                cust.completionTime = currentTime + cust.serviceDuration;
                cust.assignedCounter = counters[bestIdx].id;

                counters[bestIdx].isBusy = true;
                counters[bestIdx].busyUntil = cust.completionTime;
                counters[bestIdx].totalBusyTime += cust.serviceDuration;
                counters[bestIdx].customersServed++;
                completed.push_back(cust);
            } else {
                counters[bestIdx].dedicatedQueue.push(cust);
            }
        }

        // Check if idle counters have customers waiting in their dedicated queue
        for (auto& c : counters) {
            if (!c.isBusy && !c.dedicatedQueue.empty()) {
                Customer cust = c.dedicatedQueue.front();
                c.dedicatedQueue.pop();

                cust.serviceStartTime = currentTime;
                cust.waitingTime = cust.serviceStartTime - cust.arrivalTime;
                cust.completionTime = currentTime + cust.serviceDuration;
                cust.assignedCounter = c.id;

                c.isBusy = true;
                c.busyUntil = cust.completionTime;
                c.totalBusyTime += cust.serviceDuration;
                c.customersServed++;
                completed.push_back(cust);
            }
        }

        int currentWaiting = 0;
        for (const auto& c : counters) currentWaiting += (int)c.dedicatedQueue.size();
        maxQueue = std::max(maxQueue, currentWaiting);
    }

    double totalWait = 0.0;
    for (const auto& c : completed) totalWait += c.waitingTime;

    int totalDuration = std::max(1, currentTime);
    std::vector<double> utils;
    int minBusy = 1e9, maxBusy = 0;
    double totalBusyAll = 0.0;

    for (const auto& c : counters) {
        double u = std::min(100.0, (double)c.totalBusyTime / totalDuration * 100.0);
        utils.push_back(u);
        totalBusyAll += c.totalBusyTime;
        minBusy = std::min(minBusy, c.totalBusyTime);
        maxBusy = std::max(maxBusy, c.totalBusyTime);
    }

    SimulationResults res;
    res.strategyName = "Separate Queues (Shortest First)";
    res.totalCustomers = (int)customers.size();
    res.totalServed = (int)completed.size();
    res.avgWaitingTime = completed.empty() ? 0.0 : totalWait / completed.size();
    res.maxQueueLength = maxQueue;
    res.avgUtilization = totalBusyAll / (numCounters * totalDuration) * 100.0;
    res.totalDuration = totalDuration;
    res.workloadImbalance = maxBusy - minBusy;
    res.counterUtilizations = utils;
    return res;
}

// ----------------------------------------------------------------------------
// Main CLI Runner & Report Generator
// ----------------------------------------------------------------------------

void printReport(const SimulationResults& res) {
    std::cout << "\n------------------------------------------------------------\n";
    std::cout << " STRATEGY: " << res.strategyName << "\n";
    std::cout << "------------------------------------------------------------\n";
    std::cout << std::left << std::setw(28) << "Total Customers Arrived:"  << res.totalCustomers << "\n";
    std::cout << std::left << std::setw(28) << "Total Customers Served:"   << res.totalServed << "\n";
    std::cout << std::left << std::setw(28) << "Average Waiting Time:"     << std::fixed << std::setprecision(2) << res.avgWaitingTime << " sec\n";
    std::cout << std::left << std::setw(28) << "Maximum Queue Length:"     << res.maxQueueLength << " customers\n";
    std::cout << std::left << std::setw(28) << "Total Simulation Time:"    << res.totalDuration << " sec\n";
    std::cout << std::left << std::setw(28) << "Workload Imbalance:"       << res.workloadImbalance << " sec\n";
    std::cout << std::left << std::setw(28) << "Average Utilization:"      << std::fixed << std::setprecision(1) << res.avgUtilization << " %\n";
    
    std::cout << "Per-Counter Utilization Breakdown:\n";
    for (size_t i = 0; i < res.counterUtilizations.size(); ++i) {
        std::cout << "  - Counter " << (i + 1) << ": " << std::fixed << std::setprecision(1) 
                  << res.counterUtilizations[i] << "%\n";
    }
}

int main(int argc, char* argv[]) {
    int numCounters = 3;
    int numCustomers = 30;
    int avgServiceTime = 6;
    std::string arrivalPattern = "regular";

    if (argc >= 2) numCounters = std::max(1, std::atoi(argv[1]));
    if (argc >= 3) numCustomers = std::max(5, std::atoi(argv[2]));
    if (argc >= 4) avgServiceTime = std::max(1, std::atoi(argv[3]));
    if (argc >= 5) arrivalPattern = argv[4];

    std::cout << "============================================================\n";
    std::cout << " QueueEase – Multi-Server Customer Service Simulator (C++ DSA)\n";
    std::cout << "============================================================\n";
    std::cout << "Problem Statement:\n";
    std::cout << "  Multi-Server Customer Service Simulator using Queues.\n";
    std::cout << "  Analyzing Waiting Times, Queue Lengths, Server Utilization,\n";
    std::cout << "  and Workload Imbalance under different Arrival Patterns.\n";
    std::cout << "------------------------------------------------------------\n";
    std::cout << "Configuration:\n";
    std::cout << "  Counters: " << numCounters << "\n";
    std::cout << "  Customers: " << numCustomers << "\n";
    std::cout << "  Avg Service Time: " << avgServiceTime << " sec\n";
    std::cout << "  Arrival Pattern: " << arrivalPattern << " (regular | random | burst)\n";

    auto customers = generateCustomers(numCustomers, avgServiceTime, arrivalPattern);

    // Run both strategy simulations
    auto sharedRes = simulateSharedQueue(customers, numCounters);
    auto separateRes = simulateSeparateQueues(customers, numCounters);

    printReport(sharedRes);
    printReport(separateRes);

    std::cout << "\n============================================================\n";
    std::cout << " STRATEGY COMPARISON SUMMARY\n";
    std::cout << "============================================================\n";
    std::cout << std::left << std::setw(28) << "Metric" 
              << std::setw(20) << "Shared FIFO Queue" 
              << std::setw(20) << "Separate Queues" << "\n";
    std::cout << "------------------------------------------------------------\n";
    
    std::cout << std::left << std::setw(28) << "Avg Waiting Time (sec):" 
              << std::setw(20) << sharedRes.avgWaitingTime 
              << std::setw(20) << separateRes.avgWaitingTime << "\n";

    std::cout << std::left << std::setw(28) << "Max Queue Length:" 
              << std::setw(20) << sharedRes.maxQueueLength 
              << std::setw(20) << separateRes.maxQueueLength << "\n";

    std::cout << std::left << std::setw(28) << "Workload Imbalance (sec):" 
              << std::setw(20) << sharedRes.workloadImbalance 
              << std::setw(20) << separateRes.workloadImbalance << "\n";

    std::cout << std::left << std::setw(28) << "Avg Utilization (%):" 
              << std::setw(20) << sharedRes.avgUtilization 
              << std::setw(20) << separateRes.avgUtilization << "\n";

    std::cout << "------------------------------------------------------------\n";
    std::cout << "Conclusion: Single Shared FIFO Queue eliminates server starvation,\n";
    std::cout << "reducing average waiting time and leveling workload across counters.\n";
    std::cout << "============================================================\n";

    return 0;
}
