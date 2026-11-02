/**
 * ============================================================================
 * QueueEase – Customer Service Manager (script.js)
 * Clean, interactive multi-server queue management simulator.
 *
 * Implements:
 *   - FIFO Queue Scheduling (Single Shared vs Separate Queues per Counter)
 *   - Symmetric Multiprocessing / Multi-Resource Allocation
 *   - Live Real-Time & Discrete Clock Simulation
 *   - Manual & Automated Customer Ingestion
 *   - Manual & Automated Service Completion
 *   - Live Numerical Statistics (No charts or graphs)
 *   - Customer Service History & CSV Export
 *   - Deterministic Strategy Benchmark Comparison
 * ============================================================================
 */

'use strict';

// ---------------------------------------------------------------------------
// 1. GLOBAL STATE & CONFIGURATION
// ---------------------------------------------------------------------------

const AppState = {
  // Simulation Control
  status: 'stopped', // 'stopped' | 'running' | 'paused'
  simTime: 0,        // Elapsed simulation time in seconds
  timerInterval: null,
  nextAutoArrivalIn: 3,

  // Settings
  config: {
    numCounters: 3,
    arrivalPattern: 'regular', // 'regular' | 'random' | 'burst'
    avgServiceTime: 6,         // seconds
    simDuration: 120,          // seconds
    strategy: 'shared',        // 'shared' | 'separate'
  },

  // Counters: array of counter objects
  // { id: 1, isBusy: false, currentCustomer: null, serviceStartTime: 0, remainingService: 0, busyTime: 0, servedCount: 0 }
  counters: [],

  // Waiting Queue(s)
  // Shared queue: array of customer objects
  // In 'separate' mode, each counter also has its own queue array in counter.queue
  sharedQueue: [],

  // Service History: completed customer records
  history: [],

  // Tracking Counters & IDs
  nextCustomerId: 1,

  // Statistics
  stats: {
    totalArrived: 0,
    totalServed: 0,
    maxQueueLength: 0,
    longestWaitTime: 0,
    totalWaitTimeServed: 0,
  }
};

// ---------------------------------------------------------------------------
// 2. DOM ELEMENT REFERENCES
// ---------------------------------------------------------------------------

const DOM = {
  // Header / Controls
  simStatusBadge: document.getElementById('simStatusBadge'),
  timerDisplay: document.getElementById('timerDisplay'),
  btnStart: document.getElementById('btnStart'),
  btnPause: document.getElementById('btnPause'),
  btnReset: document.getElementById('btnReset'),
  feedbackAlert: document.getElementById('feedbackAlert'),

  // Settings
  settingsForm: document.getElementById('settingsForm'),
  inputCounters: document.getElementById('inputCounters'),
  selectPattern: document.getElementById('selectPattern'),
  inputAvgService: document.getElementById('inputAvgService'),
  inputDuration: document.getElementById('inputDuration'),
  selectStrategy: document.getElementById('selectStrategy'),
  settingsFeedback: document.getElementById('settingsFeedback'),
  activeStrategyNotice: document.getElementById('activeStrategyNotice'),

  // Add Customer Form & Buttons
  addCustomerForm: document.getElementById('addCustomerForm'),
  inputCustomerName: document.getElementById('inputCustomerName'),
  selectServiceType: document.getElementById('selectServiceType'),
  btnAddCustomer: document.getElementById('btnAddCustomer'),
  btnGen1: document.getElementById('btnGen1'),
  btnGen5: document.getElementById('btnGen5'),
  btnGenBurst: document.getElementById('btnGenBurst'),

  // Counters Section
  countersContainer: document.getElementById('countersContainer'),

  // Queue Section
  queueCountBadge: document.getElementById('queueCountBadge'),
  queueStrategyInfo: document.getElementById('queueStrategyInfo'),
  queueTableBody: document.getElementById('queueTableBody'),

  // Statistics
  statTotalArrived: document.getElementById('statTotalArrived'),
  statTotalServed: document.getElementById('statTotalServed'),
  statCurrentlyWaiting: document.getElementById('statCurrentlyWaiting'),
  statAvgWait: document.getElementById('statAvgWait'),
  statLongestWait: document.getElementById('statLongestWait'),
  statMaxQueue: document.getElementById('statMaxQueue'),
  statAvgUtilization: document.getElementById('statAvgUtilization'),
  statWorkloadImbalance: document.getElementById('statWorkloadImbalance'),
  utilizationTableBody: document.getElementById('utilizationTableBody'),

  // Strategy Comparison
  btnRunComparison: document.getElementById('btnRunComparison'),
  comparisonTableBody: document.getElementById('comparisonTableBody'),

  // History & Export
  historyTableBody: document.getElementById('historyTableBody'),
  btnExportCSV: document.getElementById('btnExportCSV'),
  btnClearHistory: document.getElementById('btnClearHistory'),
};

// ---------------------------------------------------------------------------
// 3. INITIALIZATION & SETUP
// ---------------------------------------------------------------------------

function initApp() {
  initCounters(AppState.config.numCounters);
  updateStatusUI();
  renderCounters();
  renderQueue();
  renderStatistics();
  renderHistory();
  attachEventListeners();
  runStrategyComparison(true);
}

/**
 * Initializes counter objects based on count.
 */
function initCounters(count) {
  AppState.counters = [];
  for (let i = 1; i <= count; i++) {
    AppState.counters.push({
      id: i,
      isBusy: false,
      currentCustomer: null,
      serviceStartTime: 0,
      remainingService: 0,
      busyTime: 0,
      servedCount: 0,
      queue: [], // used when strategy is 'separate'
    });
  }
}

/**
 * Attaches all event listeners for buttons and forms.
 */
function attachEventListeners() {
  // Simulation Controls
  DOM.btnStart.addEventListener('click', handleStartResume);
  DOM.btnPause.addEventListener('click', handlePause);
  DOM.btnReset.addEventListener('click', handleReset);

  // Settings
  DOM.settingsForm.addEventListener('submit', handleApplySettings);

  // Add Customer
  DOM.addCustomerForm.addEventListener('submit', handleAddCustomerSubmit);
  DOM.btnGen1.addEventListener('click', () => autoGenerateCustomers(1));
  DOM.btnGen5.addEventListener('click', () => autoGenerateCustomers(5));
  DOM.btnGenBurst.addEventListener('click', () => autoGenerateCustomers(10));

  // Comparison Benchmark
  DOM.btnRunComparison.addEventListener('click', runStrategyComparison);

  // History CSV Export & Clear
  DOM.btnExportCSV.addEventListener('click', exportHistoryToCSV);
  DOM.btnClearHistory.addEventListener('click', handleClearHistory);
}

// ---------------------------------------------------------------------------
// 4. SIMULATION CLOCK & TIMER LOOP
// ---------------------------------------------------------------------------

function handleStartResume() {
  if (AppState.status === 'running') return;

  AppState.status = 'running';
  updateStatusUI();
  showAlert('Simulation started. Real-time queue processing active.', 'info');

  // Set up 1-second tick interval
  if (!AppState.timerInterval) {
    AppState.timerInterval = setInterval(simulationTick, 1000);
  }
}

function handlePause() {
  if (AppState.status !== 'running') return;

  AppState.status = 'paused';
  updateStatusUI();
  showAlert('Simulation paused. Counter service and customer arrivals held.', 'warning');

  if (AppState.timerInterval) {
    clearInterval(AppState.timerInterval);
    AppState.timerInterval = null;
  }
}

function handleReset() {
  if (AppState.timerInterval) {
    clearInterval(AppState.timerInterval);
    AppState.timerInterval = null;
  }

  AppState.status = 'stopped';
  AppState.simTime = 0;
  AppState.nextAutoArrivalIn = 3;
  AppState.sharedQueue = [];
  AppState.history = [];
  AppState.nextCustomerId = 1;

  AppState.stats = {
    totalArrived: 0,
    totalServed: 0,
    maxQueueLength: 0,
    longestWaitTime: 0,
    totalWaitTimeServed: 0,
  };

  initCounters(AppState.config.numCounters);

  updateStatusUI();
  renderCounters();
  renderQueue();
  renderStatistics();
  renderHistory();

  showAlert('Simulation reset. All queues, counters, and statistics cleared.', 'info');
}

/**
 * Core simulation tick (executes once every real second when running)
 */
function simulationTick() {
  AppState.simTime++;
  DOM.timerDisplay.textContent = `Time: ${AppState.simTime}s`;

  // 1. Process active counters (countdown remaining service)
  AppState.counters.forEach(counter => {
    if (counter.isBusy) {
      counter.busyTime++;
      counter.remainingService--;

      // Check if service completed
      if (counter.remainingService <= 0) {
        completeCounterService(counter.id, false);
      }
    }
  });

  // 2. Automated customer arrival scheduler
  processAutoArrivals();

  // 3. Update waiting customer times
  updateLiveWaitingTimes();

  // 4. Update UI
  renderCounters();
  renderQueue();
  renderStatistics();

  // 5. Check if simulation duration reached
  if (AppState.simTime >= AppState.config.simDuration) {
    handlePause();
    showAlert(`Simulation duration reached (${AppState.config.simDuration}s). Paused automatically.`, 'info');
  }
}

/**
 * Updates status badge and button states.
 */
function updateStatusUI() {
  DOM.simStatusBadge.className = 'badge';

  if (AppState.status === 'running') {
    DOM.simStatusBadge.classList.add('badge-running');
    DOM.simStatusBadge.textContent = 'Running';
    DOM.btnStart.textContent = 'Running';
    DOM.btnStart.disabled = true;
    DOM.btnPause.disabled = false;
    DOM.btnPause.textContent = 'Pause';
  } else if (AppState.status === 'paused') {
    DOM.simStatusBadge.classList.add('badge-paused');
    DOM.simStatusBadge.textContent = 'Paused';
    DOM.btnStart.textContent = 'Resume';
    DOM.btnStart.disabled = false;
    DOM.btnPause.disabled = true;
  } else {
    DOM.simStatusBadge.classList.add('badge-stopped');
    DOM.simStatusBadge.textContent = 'Stopped';
    DOM.btnStart.textContent = 'Start Simulation';
    DOM.btnStart.disabled = false;
    DOM.btnPause.disabled = true;
  }

  DOM.timerDisplay.textContent = `Time: ${AppState.simTime}s`;
}

// ---------------------------------------------------------------------------
// 5. SETTINGS HANDLER
// ---------------------------------------------------------------------------

function handleApplySettings(e) {
  e.preventDefault();

  const numCounters = parseInt(DOM.inputCounters.value, 10);
  const arrivalPattern = DOM.selectPattern.value;
  const avgServiceTime = parseInt(DOM.inputAvgService.value, 10);
  const simDuration = parseInt(DOM.inputDuration.value, 10);
  const strategy = DOM.selectStrategy.value;

  // Validation
  if (isNaN(numCounters) || numCounters < 1 || numCounters > 5) {
    showAlert('Service counters must be between 1 and 5.', 'warning');
    return;
  }
  if (isNaN(avgServiceTime) || avgServiceTime < 1) {
    showAlert('Average service time must be at least 1 second.', 'warning');
    return;
  }
  if (isNaN(simDuration) || simDuration < 10) {
    showAlert('Simulation duration must be at least 10 seconds.', 'warning');
    return;
  }

  // Preserve busy counters / history if just adjusting settings
  const countChanged = (numCounters !== AppState.config.numCounters);
  const strategyChanged = (strategy !== AppState.config.strategy);

  AppState.config.numCounters = numCounters;
  AppState.config.arrivalPattern = arrivalPattern;
  AppState.config.avgServiceTime = avgServiceTime;
  AppState.config.simDuration = simDuration;
  AppState.config.strategy = strategy;

  DOM.activeStrategyNotice.textContent = strategy === 'shared'
    ? 'Strategy: Single Shared Queue'
    : 'Strategy: Separate Queues per Counter';

  DOM.queueStrategyInfo.textContent = strategy === 'shared'
    ? 'FIFO order applied across shared pool'
    : 'Customers routed to shortest counter queue';

  if (countChanged || strategyChanged) {
    // Reinitialize counter array
    initCounters(numCounters);
    AppState.sharedQueue = [];
    showAlert(`Applied settings: ${numCounters} counters, ${strategy === 'shared' ? 'Shared FIFO' : 'Separate Queues'}. Queues reset.`, 'info');
  } else {
    showAlert('Simulation settings updated successfully.', 'success');
  }

  DOM.settingsFeedback.textContent = 'Settings Applied!';
  setTimeout(() => { DOM.settingsFeedback.textContent = ''; }, 2500);

  renderCounters();
  renderQueue();
  renderStatistics();
}

// ---------------------------------------------------------------------------
// 6. CUSTOMER QUEUE MANAGEMENT & INGESTION
// ---------------------------------------------------------------------------

/**
 * Creates a new customer object.
 */
function createCustomer(customName, customService) {
  const idNumber = AppState.nextCustomerId++;
  const idTag = `C${idNumber}`;
  const name = customName && customName.trim() ? customName.trim() : idTag;
  const serviceType = customService || 'General Inquiry';

  // Calculate customer's service duration (variance around avgServiceTime)
  const avg = AppState.config.avgServiceTime;
  // Variance: ±30% around avg, min 1 second
  const variance = Math.max(1, Math.round(avg * 0.3));
  const randomDelta = Math.floor(Math.random() * (variance * 2 + 1)) - variance;
  const duration = Math.max(1, avg + randomDelta);

  return {
    id: idTag,
    name: name,
    serviceType: serviceType,
    serviceDuration: duration,
    arrivalTime: AppState.simTime,
    serviceStartTime: null,
    completionTime: null,
    waitingTime: 0,
    assignedCounter: null,
  };
}

/**
 * Handles manual customer addition from form.
 */
function handleAddCustomerSubmit(e) {
  e.preventDefault();

  const name = DOM.inputCustomerName.value;
  const serviceType = DOM.selectServiceType.value;
  const customer = createCustomer(name, serviceType);

  ingestCustomer(customer);

  DOM.inputCustomerName.value = '';
  showAlert(`Customer ${customer.id} (${customer.name}) arrived.`, 'info');
}

/**
 * Batch generates customers for testing.
 */
function autoGenerateCustomers(count) {
  const serviceTypes = [
    'General Inquiry',
    'Account Services',
    'Cash Deposit / Withdrawal',
    'Loan Application',
    'Technical Support'
  ];

  for (let i = 0; i < count; i++) {
    const randomType = serviceTypes[Math.floor(Math.random() * serviceTypes.length)];
    const customer = createCustomer(null, randomType);
    ingestCustomer(customer);
  }

  showAlert(`Added ${count} customer(s) to the system.`, 'info');
}

/**
 * Handles automated arrival scheduler during continuous simulation.
 */
function processAutoArrivals() {
  AppState.nextAutoArrivalIn--;

  if (AppState.nextAutoArrivalIn <= 0) {
    const pattern = AppState.config.arrivalPattern;

    if (pattern === 'regular') {
      autoGenerateCustomers(1);
      AppState.nextAutoArrivalIn = 3; // regular every 3s
    } else if (pattern === 'random') {
      autoGenerateCustomers(1);
      AppState.nextAutoArrivalIn = Math.floor(Math.random() * 5) + 2; // 2s - 6s
    } else if (pattern === 'burst') {
      // 30% chance of a burst of 3-5 customers, otherwise 1 customer
      const isBurst = Math.random() < 0.35;
      const count = isBurst ? Math.floor(Math.random() * 3) + 3 : 1;
      autoGenerateCustomers(count);
      AppState.nextAutoArrivalIn = isBurst ? 7 : 3;
    }
  }
}

/**
 * Central customer ingestion logic:
 * Routes customer to an available counter or into waiting queue.
 */
function ingestCustomer(customer) {
  AppState.stats.totalArrived++;

  if (AppState.config.strategy === 'shared') {
    // SINGLE SHARED QUEUE:
    // Look for first available counter
    const freeCounter = AppState.counters.find(c => !c.isBusy);

    if (freeCounter) {
      assignCustomerToCounter(customer, freeCounter);
    } else {
      AppState.sharedQueue.push(customer);
    }
  } else {
    // SEPARATE QUEUES PER COUNTER (Shortest Queue First):
    // Find counter with least total load (1 if busy + queue length)
    let bestCounter = AppState.counters[0];
    let minLoad = (bestCounter.isBusy ? 1 : 0) + bestCounter.queue.length;

    for (let i = 1; i < AppState.counters.length; i++) {
      const c = AppState.counters[i];
      const load = (c.isBusy ? 1 : 0) + c.queue.length;
      if (load < minLoad) {
        minLoad = load;
        bestCounter = c;
      }
    }

    if (!bestCounter.isBusy && bestCounter.queue.length === 0) {
      assignCustomerToCounter(customer, bestCounter);
    } else {
      customer.assignedCounter = bestCounter.id;
      bestCounter.queue.push(customer);
    }
  }

  // Update max queue length statistic
  updateMaxQueueLength();
  renderCounters();
  renderQueue();
  renderStatistics();
}

/**
 * Dispatches a customer to a counter.
 */
function assignCustomerToCounter(customer, counter) {
  customer.serviceStartTime = AppState.simTime;
  customer.waitingTime = Math.max(0, customer.serviceStartTime - customer.arrivalTime);
  customer.assignedCounter = counter.id;

  counter.isBusy = true;
  counter.currentCustomer = customer;
  counter.serviceStartTime = AppState.simTime;
  counter.remainingService = customer.serviceDuration;

  // Track longest wait
  if (customer.waitingTime > AppState.stats.longestWaitTime) {
    AppState.stats.longestWaitTime = customer.waitingTime;
  }
}

/**
 * Completes service at a counter (manual button or automatic timer).
 */
function completeCounterService(counterId, isManualTrigger) {
  const counter = AppState.counters.find(c => c.id === counterId);
  if (!counter || !counter.isBusy || !counter.currentCustomer) return;

  const customer = counter.currentCustomer;
  customer.completionTime = AppState.simTime;
  counter.servedCount++;
  AppState.stats.totalServed++;
  AppState.stats.totalWaitTimeServed += customer.waitingTime;

  // Record into history
  AppState.history.unshift({
    id: customer.id,
    name: customer.name,
    serviceType: customer.serviceType,
    arrivalTime: customer.arrivalTime,
    serviceStartTime: customer.serviceStartTime,
    completionTime: customer.completionTime,
    waitingTime: customer.waitingTime,
    counterId: counter.id,
  });

  if (isManualTrigger) {
    showAlert(`Service completed manually for ${customer.id} at Counter ${counter.id}.`, 'success');
  }

  // Free the counter
  counter.isBusy = false;
  counter.currentCustomer = null;
  counter.remainingService = 0;

  // Dispatch next waiting customer according to policy
  dispatchNextCustomer(counter);

  renderCounters();
  renderQueue();
  renderStatistics();
  renderHistory();
}

/**
 * Dispatches next waiting customer to an available counter.
 */
function dispatchNextCustomer(counter) {
  if (AppState.config.strategy === 'shared') {
    if (AppState.sharedQueue.length > 0) {
      const nextCustomer = AppState.sharedQueue.shift();
      assignCustomerToCounter(nextCustomer, counter);
    }
  } else {
    // Separate queues mode: counter pulls from its own queue
    if (counter.queue.length > 0) {
      const nextCustomer = counter.queue.shift();
      assignCustomerToCounter(nextCustomer, counter);
    }
  }
}

/**
 * Updates live waiting time for all customers currently waiting.
 */
function updateLiveWaitingTimes() {
  if (AppState.config.strategy === 'shared') {
    AppState.sharedQueue.forEach(c => {
      c.waitingTime = Math.max(0, AppState.simTime - c.arrivalTime);
    });
  } else {
    AppState.counters.forEach(cnt => {
      cnt.queue.forEach(c => {
        c.waitingTime = Math.max(0, AppState.simTime - c.arrivalTime);
      });
    });
  }
}

/**
 * Calculates and updates current & max queue length.
 */
function updateMaxQueueLength() {
  let currentTotalWaiting = 0;
  if (AppState.config.strategy === 'shared') {
    currentTotalWaiting = AppState.sharedQueue.length;
  } else {
    currentTotalWaiting = AppState.counters.reduce((sum, c) => sum + c.queue.length, 0);
  }

  if (currentTotalWaiting > AppState.stats.maxQueueLength) {
    AppState.stats.maxQueueLength = currentTotalWaiting;
  }
}

// ---------------------------------------------------------------------------
// 7. UI RENDERING FUNCTIONS
// ---------------------------------------------------------------------------

/**
 * Renders the service counter cards.
 */
function renderCounters() {
  DOM.countersContainer.innerHTML = '';

  AppState.counters.forEach(counter => {
    const card = document.createElement('div');
    card.className = `counter-card ${counter.isBusy ? 'is-busy' : ''}`;

    const statusBadge = counter.isBusy
      ? `<span class="badge badge-busy">Busy</span>`
      : `<span class="badge badge-available">Available</span>`;

    let customerInfoHtml = '';
    if (counter.isBusy && counter.currentCustomer) {
      const c = counter.currentCustomer;
      customerInfoHtml = `
        <div class="counter-customer-box">
          <span class="customer-name-tag">${c.name} (${c.id})</span>
          <span class="customer-service-tag">${c.serviceType}</span>
        </div>
        <div class="counter-detail-row">
          <span>Started:</span>
          <span class="counter-detail-value">${c.serviceStartTime}s</span>
        </div>
        <div class="counter-detail-row">
          <span>Remaining:</span>
          <span class="counter-detail-value">${counter.remainingService}s</span>
        </div>
      `;
    } else {
      customerInfoHtml = `
        <div class="counter-customer-box" style="color: var(--text-subtle); text-align: center; padding: 12px 0;">
          Counter Idle
        </div>
        <div class="counter-detail-row">
          <span>Started:</span>
          <span class="counter-detail-value">—</span>
        </div>
        <div class="counter-detail-row">
          <span>Remaining:</span>
          <span class="counter-detail-value">—</span>
        </div>
      `;
    }

    // Separate queues counter specific queue size
    let queueInfo = '';
    if (AppState.config.strategy === 'separate') {
      queueInfo = `
        <div class="counter-detail-row">
          <span>In Counter Queue:</span>
          <span class="counter-detail-value">${counter.queue.length}</span>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="counter-card-header">
        <span class="counter-name">Counter ${counter.id}</span>
        ${statusBadge}
      </div>

      ${customerInfoHtml}

      <div class="counter-detail-row">
        <span>Customers Served:</span>
        <span class="counter-detail-value">${counter.servedCount}</span>
      </div>

      ${queueInfo}

      <div class="counter-card-actions">
        <button
          type="button"
          class="btn btn-complete btn-sm"
          style="width: 100%;"
          data-counter-id="${counter.id}"
          ${!counter.isBusy ? 'disabled' : ''}>
          ✓ Complete Service
        </button>
      </div>
    `;

    DOM.countersContainer.appendChild(card);
  });

  // Attach Complete Service button clicks
  DOM.countersContainer.querySelectorAll('.btn-complete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const counterId = parseInt(e.currentTarget.getAttribute('data-counter-id'), 10);
      completeCounterService(counterId, true);
    });
  });
}

/**
 * Renders the customer waiting queue table.
 */
function renderQueue() {
  DOM.queueTableBody.innerHTML = '';

  let waitingList = [];

  if (AppState.config.strategy === 'shared') {
    waitingList = AppState.sharedQueue.map((c, idx) => ({
      position: idx + 1,
      customer: c,
      target: 'Next Available',
    }));
  } else {
    // In separate queues, gather waiting customers across all counters
    let pos = 1;
    AppState.counters.forEach(counter => {
      counter.queue.forEach(c => {
        waitingList.push({
          position: pos++,
          customer: c,
          target: `Counter ${counter.id}`,
        });
      });
    });
  }

  DOM.queueCountBadge.textContent = `${waitingList.length} waiting`;

  if (waitingList.length === 0) {
    DOM.queueTableBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="6">No customers currently in the waiting queue.</td>
      </tr>
    `;
    return;
  }

  waitingList.forEach(item => {
    const c = item.customer;
    const currentWait = Math.max(0, AppState.simTime - c.arrivalTime);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="text-mono">#${item.position}</td>
      <td class="text-mono"><strong>${c.name}</strong> <span class="text-muted">(${c.id})</span></td>
      <td>${c.arrivalTime}s</td>
      <td>${c.serviceType}</td>
      <td class="text-mono">${currentWait}s</td>
      <td><span class="badge badge-stopped">${item.target}</span></td>
    `;
    DOM.queueTableBody.appendChild(tr);
  });
}

/**
 * Renders the Useful Statistics section & utilization breakdown table.
 */
function renderStatistics() {
  const arrived = AppState.stats.totalArrived;
  const served = AppState.stats.totalServed;

  let currentWaiting = 0;
  if (AppState.config.strategy === 'shared') {
    currentWaiting = AppState.sharedQueue.length;
  } else {
    currentWaiting = AppState.counters.reduce((sum, c) => sum + c.queue.length, 0);
  }

  const avgWait = served > 0
    ? (AppState.stats.totalWaitTimeServed / served).toFixed(1)
    : '0.0';

  DOM.statTotalArrived.textContent = arrived;
  DOM.statTotalServed.textContent = served;
  DOM.statCurrentlyWaiting.textContent = currentWaiting;
  DOM.statAvgWait.textContent = `${avgWait}s`;
  DOM.statLongestWait.textContent = `${AppState.stats.longestWaitTime}s`;
  DOM.statMaxQueue.textContent = AppState.stats.maxQueueLength;

  const elapsed = Math.max(1, AppState.simTime);
  const totalBusyTime = AppState.counters.reduce((sum, c) => sum + c.busyTime, 0);
  const avgUtil = AppState.counters.length > 0
    ? Math.min(100, (totalBusyTime / (AppState.counters.length * elapsed)) * 100).toFixed(1)
    : '0.0';
  DOM.statAvgUtilization.textContent = `${avgUtil}%`;

  const busyTimes = AppState.counters.map(c => c.busyTime);
  const imbalance = busyTimes.length > 0 ? (Math.max(...busyTimes) - Math.min(...busyTimes)) : 0;
  DOM.statWorkloadImbalance.textContent = `${imbalance}s`;

  // Counter Utilization Breakdown Table
  DOM.utilizationTableBody.innerHTML = '';

  AppState.counters.forEach(c => {
    const utilPct = Math.min(100, Math.round((c.busyTime / elapsed) * 100));
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>Counter ${c.id}</strong></td>
      <td><span class="badge ${c.isBusy ? 'badge-busy' : 'badge-available'}">${c.isBusy ? 'Busy' : 'Available'}</span></td>
      <td class="text-mono">${c.servedCount}</td>
      <td class="text-mono">${c.busyTime}s</td>
      <td class="text-mono"><strong>${utilPct}%</strong></td>
    `;
    DOM.utilizationTableBody.appendChild(tr);
  });
}

/**
 * Renders completed customer service history table.
 */
function renderHistory() {
  DOM.historyTableBody.innerHTML = '';

  if (AppState.history.length === 0) {
    DOM.historyTableBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="7">No completed customer records yet.</td>
      </tr>
    `;
    DOM.btnExportCSV.disabled = true;
    DOM.btnClearHistory.disabled = true;
    return;
  }

  DOM.btnExportCSV.disabled = false;
  DOM.btnClearHistory.disabled = false;

  AppState.history.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="text-mono"><strong>${item.name}</strong> <span class="text-muted">(${item.id})</span></td>
      <td>${item.serviceType}</td>
      <td>${item.arrivalTime}s</td>
      <td>${item.serviceStartTime}s</td>
      <td>${item.completionTime}s</td>
      <td class="text-mono">${item.waitingTime}s</td>
      <td>Counter ${item.counterId}</td>
    `;
    DOM.historyTableBody.appendChild(tr);
  });
}

function handleClearHistory() {
  AppState.history = [];
  renderHistory();
  showAlert('Service history cleared.', 'info');
}

// ---------------------------------------------------------------------------
// 8. CSV EXPORT UTILITY (Section G)
// ---------------------------------------------------------------------------

function exportHistoryToCSV() {
  if (AppState.history.length === 0) {
    showAlert('No service history to export.', 'warning');
    return;
  }

  const headers = [
    'Customer ID',
    'Customer Name',
    'Service Type',
    'Arrival Time (sec)',
    'Service Start Time (sec)',
    'Completion Time (sec)',
    'Total Waiting Time (sec)',
    'Assigned Counter'
  ];

  const rows = AppState.history.map(item => [
    `"${item.id}"`,
    `"${item.name.replace(/"/g, '""')}"`,
    `"${item.serviceType.replace(/"/g, '""')}"`,
    item.arrivalTime,
    item.serviceStartTime,
    item.completionTime,
    item.waitingTime,
    `"Counter ${item.counterId}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const downloadLink = document.createElement('a');
  downloadLink.href = url;
  downloadLink.setAttribute('download', `queueease_history_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);

  showAlert('Customer service history exported as CSV successfully.', 'success');
}

// ---------------------------------------------------------------------------
// 9. STRATEGY COMPARISON BENCHMARK ENGINE (Section 5)
// ---------------------------------------------------------------------------

/**
 * Executes a deterministic comparison between:
 * 1. Single Shared FIFO Queue
 * 2. Separate Queue per Counter (Shortest First)
 * Uses 30 identical test customers with fixed arrival & service times.
 */
function runStrategyComparison(silent = false) {
  if (!silent) {
    showAlert('Running Strategy Comparison Benchmark with 30 identical test customers...', 'info');
  }

  const NUM_TEST_CUSTOMERS = 30;
  const NUM_COUNTERS = AppState.config.numCounters;

  // Create fixed deterministic customers
  const testCustomers = [];
  let arrival = 0;
  for (let i = 1; i <= NUM_TEST_CUSTOMERS; i++) {
    // Customers arrive every 2 to 4 seconds
    arrival += ((i % 3 === 0) ? 1 : (i % 2 === 0 ? 3 : 2));
    // Service duration varies from 4 to 8 seconds
    const duration = 4 + ((i * 3) % 5);
    testCustomers.push({
      id: `C${i}`,
      arrivalTime: arrival,
      serviceDuration: duration,
    });
  }

  // Run Simulation A: Single Shared Queue
  const resultShared = simulateStrategy(JSON.parse(JSON.stringify(testCustomers)), NUM_COUNTERS, 'shared');

  // Run Simulation B: Separate Queues (Shortest First)
  const resultSeparate = simulateStrategy(JSON.parse(JSON.stringify(testCustomers)), NUM_COUNTERS, 'separate');

  // Render Comparison Table
  renderComparisonTable(resultShared, resultSeparate, silent);
}

/**
 * Pure discrete simulation function for benchmark comparison.
 */
function simulateStrategy(customers, numCounters, strategy) {
  const counters = [];
  for (let i = 1; i <= numCounters; i++) {
    counters.push({
      id: i,
      busyUntil: 0,
      busyTime: 0,
      served: 0,
      queue: [] // for separate
    });
  }

  const sharedQueue = [];
  const completed = [];
  let maxQueue = 0;
  let currentTime = 0;
  let remainingCustomers = [...customers];

  // Run discrete event loop until all customers are served
  while (remainingCustomers.length > 0 || sharedQueue.length > 0 || counters.some(c => c.queue && c.queue.length > 0) || counters.some(c => c.busyUntil > currentTime)) {
    // If no customers waiting and no arrivals currently, jump to next event
    let nextArrival = remainingCustomers.length > 0 ? remainingCustomers[0].arrivalTime : Infinity;
    let nextDeparture = Infinity;
    counters.forEach(c => {
      if (c.busyUntil > currentTime && c.busyUntil < nextDeparture) {
        nextDeparture = c.busyUntil;
      }
    });

    let nextTime = Math.min(nextArrival, nextDeparture);
    if (nextTime === Infinity) break;
    currentTime = Math.max(currentTime, nextTime);

    // Free finished counters
    counters.forEach(c => {
      if (c.busyUntil <= currentTime && c.busyUntil > 0) {
        c.busyUntil = 0;
      }
    });

    // Ingest any customer whose arrival time <= currentTime
    while (remainingCustomers.length > 0 && remainingCustomers[0].arrivalTime <= currentTime) {
      const cust = remainingCustomers.shift();

      if (strategy === 'shared') {
        const freeCounter = counters.find(c => c.busyUntil <= currentTime);
        if (freeCounter) {
          cust.serviceStart = currentTime;
          cust.waitingTime = cust.serviceStart - cust.arrivalTime;
          freeCounter.busyUntil = currentTime + cust.serviceDuration;
          freeCounter.busyTime += cust.serviceDuration;
          freeCounter.served++;
          completed.push(cust);
        } else {
          sharedQueue.push(cust);
        }
      } else {
        // Separate: assign to counter with shortest line (1 if busy + queue length)
        let best = counters[0];
        let minLoad = (best.busyUntil > currentTime ? 1 : 0) + best.queue.length;
        for (let i = 1; i < counters.length; i++) {
          const load = (counters[i].busyUntil > currentTime ? 1 : 0) + counters[i].queue.length;
          if (load < minLoad) {
            minLoad = load;
            best = counters[i];
          }
        }

        if (best.busyUntil <= currentTime && best.queue.length === 0) {
          cust.serviceStart = currentTime;
          cust.waitingTime = cust.serviceStart - cust.arrivalTime;
          best.busyUntil = currentTime + cust.serviceDuration;
          best.busyTime += cust.serviceDuration;
          best.served++;
          completed.push(cust);
        } else {
          best.queue.push(cust);
        }
      }
    }

    // Assign waiting customers to newly free counters
    if (strategy === 'shared') {
      counters.forEach(c => {
        if (c.busyUntil <= currentTime && sharedQueue.length > 0) {
          const cust = sharedQueue.shift();
          cust.serviceStart = currentTime;
          cust.waitingTime = cust.serviceStart - cust.arrivalTime;
          c.busyUntil = currentTime + cust.serviceDuration;
          c.busyTime += cust.serviceDuration;
          c.served++;
          completed.push(cust);
        }
      });
      maxQueue = Math.max(maxQueue, sharedQueue.length);
    } else {
      counters.forEach(c => {
        if (c.busyUntil <= currentTime && c.queue.length > 0) {
          const cust = c.queue.shift();
          cust.serviceStart = currentTime;
          cust.waitingTime = cust.serviceStart - cust.arrivalTime;
          c.busyUntil = currentTime + cust.serviceDuration;
          c.busyTime += cust.serviceDuration;
          c.served++;
          completed.push(cust);
        }
      });
      const totalWaiting = counters.reduce((sum, c) => sum + c.queue.length, 0);
      maxQueue = Math.max(maxQueue, totalWaiting);
    }
  }

  // Calculate metrics
  const totalWait = completed.reduce((sum, c) => sum + (c.waitingTime || 0), 0);
  const avgWait = (totalWait / completed.length).toFixed(2);
  const totalBusy = counters.reduce((sum, c) => sum + c.busyTime, 0);
  const totalSimulationDuration = Math.max(1, currentTime);
  const avgUtilization = ((totalBusy / (numCounters * totalSimulationDuration)) * 100).toFixed(1);

  const busyTimes = counters.map(c => c.busyTime);
  const workloadImbalance = (Math.max(...busyTimes) - Math.min(...busyTimes)).toFixed(1);

  return {
    totalServed: completed.length,
    avgWait: avgWait,
    maxQueue: maxQueue,
    avgUtilization: avgUtilization,
    workloadImbalance: workloadImbalance,
    simulationDuration: totalSimulationDuration,
  };
}

/**
 * Renders the comparison results table.
 */
function renderComparisonTable(shared, separate, silent = false) {
  const diffWait = (parseFloat(separate.avgWait) - parseFloat(shared.avgWait)).toFixed(2);
  const diffWaitText = parseFloat(diffWait) >= 0
    ? `Shared is faster by ${diffWait}s`
    : `Separate is faster by ${Math.abs(diffWait)}s`;

  const diffQueue = separate.maxQueue - shared.maxQueue;
  const diffQueueText = diffQueue >= 0
    ? `Shared queue was ${diffQueue} customer(s) shorter`
    : `Separate had shorter peak by ${Math.abs(diffQueue)}`;

  const rows = [
    {
      metric: 'Average Waiting Time',
      shared: `${shared.avgWait}s`,
      separate: `${separate.avgWait}s`,
      advantage: `<strong style="color: var(--color-primary);">${diffWaitText}</strong>`
    },
    {
      metric: 'Maximum Queue Length',
      shared: `${shared.maxQueue} customers`,
      separate: `${separate.maxQueue} customers`,
      advantage: diffQueueText
    },
    {
      metric: 'Customers Served',
      shared: `${shared.totalServed} / 30`,
      separate: `${separate.totalServed} / 30`,
      advantage: 'Both served all 30 customers'
    },
    {
      metric: 'Average Server Utilization',
      shared: `${shared.avgUtilization}%`,
      separate: `${separate.avgUtilization}%`,
      advantage: 'Shared eliminates server starvation'
    },
    {
      metric: 'Workload Imbalance (Max – Min Busy Time)',
      shared: `${shared.workloadImbalance}s`,
      separate: `${separate.workloadImbalance}s`,
      advantage: parseFloat(shared.workloadImbalance) <= parseFloat(separate.workloadImbalance)
        ? 'Shared achieves more balanced counter loads'
        : 'Comparable load distribution'
    },
    {
      metric: 'Total Completion Time',
      shared: `${shared.simulationDuration}s`,
      separate: `${separate.simulationDuration}s`,
      advantage: shared.simulationDuration <= separate.simulationDuration
        ? 'Shared completes entire workload faster'
        : 'Comparable makespan'
    }
  ];

  DOM.comparisonTableBody.innerHTML = rows.map(r => `
    <tr>
      <td><strong>${r.metric}</strong></td>
      <td>${r.shared}</td>
      <td>${r.separate}</td>
      <td>${r.advantage}</td>
    </tr>
  `).join('');

  if (!silent) {
    showAlert('Strategy comparison benchmark completed successfully.', 'success');
  }
}

// ---------------------------------------------------------------------------
// 10. ALERT & FEEDBACK HELPER
// ---------------------------------------------------------------------------

let alertTimeout = null;
function showAlert(message, type = 'info') {
  DOM.feedbackAlert.className = `alert alert-${type}`;
  DOM.feedbackAlert.textContent = message;
  DOM.feedbackAlert.classList.remove('hidden');

  if (alertTimeout) clearTimeout(alertTimeout);
  alertTimeout = setTimeout(() => {
    DOM.feedbackAlert.classList.add('hidden');
  }, 4000);
}

// ---------------------------------------------------------------------------
// 11. BOOTSTRAP APPLICATION
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', initApp);
