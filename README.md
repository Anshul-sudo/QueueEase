# QueueEase – Multi-Server Customer Service Simulator

**Course / Subject:** Data Structures and Algorithms (DSA)  
**Project Path:** [`d:\projects Github\ds_project\`](file:///d:/projects%20Github/ds_project/)  
**Technologies:** HTML5, CSS3, JavaScript (Vanilla), and C++14 (Standalone)  

---

## 1. Problem Statement

> **Problem Statement:**  
> Multi-Server Customer Service Simulator: Use queues to distribute requests among multiple service counters. Analyze waiting times, queue lengths, server utilization, and workload imbalance under different arrival patterns.

---

## 2. DSA Overview & Core Concepts

In multi-resource queueing systems, how requests are buffered and routed directly determines system throughput, latency, and fairness. **QueueEase** explores the performance tradeoffs of queue topologies and dispatching algorithms:

### A. Queue Abstract Data Type (ADT)
- **FIFO Semantics:** First-In, First-Out discipline guarantees that customers who arrive earlier are served earlier.
- **Core Operations:**
  - `enqueue(customer)`: Insert a new customer at the rear of the waiting queue ($O(1)$).
  - `dequeue()`: Remove and return the customer from the front of the queue to dispatch to a free counter ($O(1)$).
  - `peek()` / `front()`: Inspect the customer at the head of the queue without removal ($O(1)$).
  - `isEmpty()` / `size()`: Check queue state and active queue length ($O(1)$).

### B. Multi-Server Queue Topologies & Dispatching Algorithms
1. **Single Global Shared Queue (M/M/k FIFO):**
   - All arriving customers enter a single centralized FIFO queue.
   - Whenever any counter becomes available, the next customer from the front of the queue is immediately dispatched.
   - **DSA Advantage:** Eliminates **server starvation** (no server sits idle while any customer waits in the system), minimizing average waiting times and leveling workload distribution.
2. **Separate Queues per Counter (Shortest Queue First):**
   - Each counter maintains its own dedicated FIFO queue.
   - Arriving customers are routed using a **greedy heuristic**: they join the counter queue with the minimum total load ($\min(\text{isBusy} + \text{Queue Length}_i)$).
   - **DSA Limitation:** Vulnerable to head-of-line blocking and server starvation (e.g., one counter finishes quickly and goes idle, but cannot take customers trapped in another counter's queue).

---

## 3. Key Analysis Dimensions

The simulator provides precise numerical measurement across the four key dimensions specified in the problem statement:

| Analysis Dimension | Formula / Metric | Description |
|---|---|---|
| **1. Waiting Times** | $\text{Wait} = T_{\text{service\_start}} - T_{\text{arrival}}$<br>$\text{Avg Wait} = \frac{1}{N}\sum \text{Wait}_i$ | Measures customer delay before reaching a counter. Both **Average Waiting Time** and **Longest Waiting Time** are tracked in real time. |
| **2. Queue Lengths** | $L_{\text{queue}}(t) = |\text{Queue}(t)|$<br>$L_{\max} = \max_t L_{\text{queue}}(t)$ | Tracks buffer congestion. Both **Currently Waiting** and high-water mark **Max Queue Length** are recorded. |
| **3. Server Utilization** | $U_i = \min\left(100, \frac{\text{Busy Time}_i}{T_{\text{elapsed}}} \times 100\right)$ | Operational efficiency of each counter and the entire server pool. Prevents over-utilization or idle waste. |
| **4. Workload Imbalance** | $\text{Imbalance} = \max(T_{\text{busy}}) - \min(T_{\text{busy}})$ | Quantifies load disparity across counters. Low imbalance indicates fair, uniform distribution of work. |

### Arrival Pattern Dynamics
The simulator models system stability under three distinct arrival distributions:
- **Regular (Deterministic):** Constant, uniform inter-arrival intervals ($D/M/k$). Predictable queue behavior with minimal buffer overflow.
- **Random (Poisson / Uniform):** Stochastic inter-arrival intervals ($M/M/k$). Simulates real-world unpredictable customer arrivals with fluctuating queue spikes.
- **Burst (Batch Arrivals):** Clusters of multiple customers arrive simultaneously at the exact same timestamp ($M^{[X]}/M/k$). Stresses system capacity and exposes worst-case queue latency.

---

## 4. Time & Space Complexity Analysis

| Component / Operation | Time Complexity | Space Complexity | Explanation |
|---|---|---|---|
| **Queue Enqueue** | $O(1)$ | $O(1)$ per node | Insertion at queue rear pointer |
| **Queue Dequeue** | $O(1)$ | $O(1)$ per node | Deletion from queue head pointer |
| **Find Available Counter** | $O(k)$ | $O(1)$ | Linear scan across $k$ counters ($O(\log k)$ if using Min-Heap) |
| **Shortest Queue Greedy Selection** | $O(k)$ | $O(1)$ | Compares current queue depth across $k$ counters |
| **Continuous Simulation Tick** | $O(k)$ | $O(1)$ | Updates remaining time for busy servers |
| **Total Simulation (N customers)** | $O(N \cdot k)$ | $O(N + k)$ | Scales linearly with customer count and counter count |

---

## 5. Directory Structure

```
ds_project/
├── index.html         — Clean, minimal web UI (counters, queue table, 8 stat cards, benchmark, history)
├── style.css          — Minimal professional styling (white/light-gray background + single blue accent)
├── script.js          — Complete simulation engine, Queue ADT logic, live stats, CSV export
├── queue_manager.cpp  — Standalone C++14/C++17 queue simulation program
├── queue_manager.exe  — Compiled standalone executable (MinGW GCC)
└── README.md          — Project documentation, algorithms, complexity analysis, and viva reference
```

---

## 6. How to Run

### A. Web Application (Zero Installation)
1. Open [`index.html`](file:///d:/projects%20Github/ds_project/index.html) directly in any web browser.
2. Works 100% offline without servers, npm, databases, or build configurations.

### B. Standalone C++ Program
Compile with any C++14 or C++17 compiler:
```bash
cd "d:\projects Github\ds_project"
g++ -std=c++14 -O2 queue_manager.cpp -o queue_manager
```

Run with default parameters (3 counters, 30 customers, 6s average service time, regular pattern):
```bash
./queue_manager
```

Or pass custom parameters:
```bash
./queue_manager [num_counters] [num_customers] [avg_service_time] [arrival_pattern]

# Test Burst arrival pattern with 3 counters and 30 customers:
./queue_manager 3 30 6 burst

# Test Random arrival pattern with 4 counters and 50 customers:
./queue_manager 4 50 5 random
```

---

## 7. Sample Experimental Results (C++ Benchmark)

### Experiment: 3 Counters, 30 Customers, 6s Service Time, Burst Pattern
```text
============================================================
 STRATEGY COMPARISON SUMMARY
============================================================
Metric                      Shared FIFO Queue   Separate Queues     
------------------------------------------------------------
Avg Waiting Time (sec):     2.30 sec            3.27 sec            
Max Queue Length:           3 customers         4 customers         
Workload Imbalance (sec):   0 sec               12 sec              
Avg Utilization (%):        84.5 %              77.9 %              
------------------------------------------------------------
Conclusion: Single Shared FIFO Queue eliminates server starvation,
reducing average waiting time by 30% and eliminating workload imbalance.
============================================================
```

---

## 8. DSA Viva Preparation (Questions & Answers)

**Q1: Why is a Queue data structure used for this simulation instead of a Stack?**  
*Answer:* A Queue adheres to the First-In, First-Out (FIFO) principle, which models real-world fairness: requests that arrive first are served first. A Stack uses Last-In, First-Out (LIFO), which would cause extreme starvation for earlier requests.

**Q2: What is the difference between Array-based and Linked-List-based Queue implementations?**  
*Answer:* An array-based queue requires a circular buffer (using modulo arithmetic `(rear + 1) % capacity`) to prevent memory waste after dequeuing, and has a fixed maximum capacity. A linked-list queue dynamically allocates nodes, eliminating overflow limits at the cost of pointer memory overhead.

**Q3: What is "Server Starvation" in multi-server queues?**  
*Answer:* Server starvation occurs when a service counter is idle even though customers are waiting in the system. In a separate-queue system, if Counter A has an empty line while Counter B has 5 customers, Counter A starves unless customers can switch queues (jockeying). A single shared FIFO queue completely prevents starvation.

**Q4: What is Workload Imbalance and how is it calculated?**  
*Answer:* Workload imbalance is the difference between the most loaded server's busy time and the least loaded server's busy time:
$$\text{Workload Imbalance} = \max_{1 \le i \le k}(T_{\text{busy}, i}) - \min_{1 \le i \le k}(T_{\text{busy}, i})$$
A value of 0 indicates perfect load distribution.

**Q5: How can finding an available counter or shortest queue be optimized?**  
*Answer:* Instead of a linear search across $k$ counters ($O(k)$), we can use a **Min-Heap (Priority Queue)** ordered by available completion timestamp or queue depth. This reduces lookup and update time to $O(\log k)$, which is beneficial when $k$ is large.

**Q6: How do arrival patterns impact the queue buffer?**  
*Answer:* Under regular arrivals with service rate $\mu > \lambda$ (arrival rate), queues remain small or zero. Under burst arrivals, the arrival rate temporarily exceeds service capacity ($\lambda > k\mu$), causing sharp spikes in queue length and waiting times, demonstrating the need for buffer dimensioning.
