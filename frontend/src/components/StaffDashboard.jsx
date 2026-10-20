import { useEffect, useState, useCallback } from "react";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function StaffDashboard({ services }) {
    const [selectedService, setSelectedService] = useState("");
    const [queue, setQueue] = useState([]);
    const [message, setMessage] = useState("");
    const [messageType, setMessageType] = useState("success");
    const [statistics, setStatistics] = useState(null);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    const fetchQueue = useCallback(async (serviceId) => {
        if (!serviceId) {
            setQueue([]);
            return;
        }

        try {
            const response = await fetch(
                `${API_URL}/api/queue/${serviceId}`
            );

            if (!response.ok) {
                throw new Error("Unable to load queue.");
            }

            const data = await response.json();
            setQueue(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error fetching queue:", error);
            setMessage("Unable to load the queue. Please try again.");
            setMessageType("error");
        }
    }, []);

    const fetchStatistics = useCallback(async (serviceId) => {
        if (!serviceId) {
            setStatistics(null);
            return;
        }

        const token = localStorage.getItem("token");

        try {
            const response = await fetch(
                `${API_URL}/api/queue/${serviceId}/statistics`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (!response.ok) {
                throw new Error("Unable to load statistics.");
            }

            const data = await response.json();
            setStatistics(data);
        } catch (error) {
            console.error("Error fetching statistics:", error);
            setStatistics(null);
        }
    }, []);

    const refreshData = useCallback(
        async (serviceId) => {
            if (!serviceId) return;

            setLoading(true);

            await Promise.all([
                fetchQueue(serviceId),
                fetchStatistics(serviceId),
            ]);

            setLoading(false);
        },
        [fetchQueue, fetchStatistics]
    );

    useEffect(() => {
        if (selectedService) {
            refreshData(selectedService);
        } else {
            setQueue([]);
            setStatistics(null);
        }
    }, [selectedService, refreshData]);

    // Refresh the selected queue periodically.
    useEffect(() => {
        if (!selectedService) return;

        const interval = setInterval(() => {
            refreshData(selectedService);
        }, 10000);

        return () => clearInterval(interval);
    }, [selectedService, refreshData]);

    const performQueueAction = async (action) => {
        if (!selectedService) {
            setMessage("Please select a service first.");
            setMessageType("error");
            return;
        }

        const token = localStorage.getItem("token");

        if (!token) {
            setMessage("Your session has expired. Please log in again.");
            setMessageType("error");
            return;
        }

        setActionLoading(true);
        setMessage("");

        try {
            const response = await fetch(
                `${API_URL}/api/queue/${selectedService}/${action}`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            const data = await response.json();

            if (!response.ok || data.error) {
                setMessage(
                    data.error || "The queue action could not be completed."
                );
                setMessageType("error");
                return;
            }

            if (action === "serve-next") {
                setMessage(
                    `Now serving token #${data.tokenNumber}.`
                );
            } else {
                setMessage("Current customer completed successfully.");
            }

            setMessageType("success");

            await refreshData(selectedService);
        } catch (error) {
            console.error("Queue action failed:", error);
            setMessage("Unable to contact the server. Please try again.");
            setMessageType("error");
        } finally {
            setActionLoading(false);
        }
    };

    const servingCustomer = queue.find(
        (entry) => entry.status === "serving"
    );

    const waitingCustomers = queue.filter(
        (entry) => entry.status === "waiting"
    );

    const completedCustomers = queue.filter(
        (entry) => entry.status === "completed"
    );

    const averageTime = Number(
        statistics?.average_service_time ?? 0
    );

    return (
        <div className="staff-ui">
            {/* Service selection */}
            <div className="staff-toolbar">
                <div className="staff-service-field">
                    <label htmlFor="staff-service-select">
                        MANAGE SERVICE
                    </label>

                    <select
                        id="staff-service-select"
                        value={selectedService}
                        onChange={(event) => {
                            setSelectedService(event.target.value);
                            setMessage("");
                        }}
                    >
                        <option value="">Select a service</option>

                        {services.map((service) => (
                            <option key={service.id} value={service.id}>
                                {service.name}
                            </option>
                        ))}
                    </select>
                </div>

                {selectedService && (
                    <button
                        type="button"
                        className="staff-refresh-button"
                        onClick={() => refreshData(selectedService)}
                        disabled={loading}
                    >
                        ↻ {loading ? "Refreshing..." : "Refresh"}
                    </button>
                )}
            </div>

            {!selectedService ? (
                <div className="staff-empty-state">
                    <div className="staff-empty-icon">▦</div>
                    <h3>Select a service to get started</h3>
                    <p>
                        Manage customers, serve the next token, and monitor
                        queue performance from one place.
                    </p>
                </div>
            ) : (
                <>
                    {/* Action feedback */}
                    {message && (
                        <div
                            className={`staff-message staff-message-${messageType}`}
                            role="status"
                        >
                            <span>
                                {messageType === "error" ? "!" : "✓"}
                            </span>
                            <strong>{message}</strong>
                        </div>
                    )}

                    {/* Current customer */}
                    <section className="staff-serving-panel">
                        <div className="staff-panel-heading">
                            <div>
                                <span className="staff-eyebrow">
                                    COUNTER STATUS
                                </span>
                                <h3>Now Serving</h3>
                                <p>
                                    Manage the customer currently at your
                                    counter.
                                </p>
                            </div>

                            <span
                                className={`staff-counter-status ${servingCustomer
                                    ? "staff-counter-active"
                                    : "staff-counter-idle"
                                    }`}
                            >
                                <span />
                                {servingCustomer ? "In Service" : "Counter Idle"}
                            </span>
                        </div>

                        {servingCustomer ? (
                            <div className="staff-current-customer">
                                <div className="staff-large-token">
                                    #{servingCustomer.token_number}
                                </div>

                                <div className="staff-current-details">
                                    <span>CURRENT CUSTOMER</span>
                                    <h4>
                                        {servingCustomer.customer_name}
                                    </h4>
                                    <p>
                                        Token #{servingCustomer.token_number}
                                        {" · "}Service in progress
                                    </p>
                                </div>

                                <span className="qs-status-badge qs-status-serving">
                                    <span className="qs-status-dot" />
                                    Serving
                                </span>
                            </div>
                        ) : (
                            <div className="staff-idle-message">
                                <div className="staff-idle-icon">◷</div>
                                <div>
                                    <strong>No customer is being served</strong>
                                    <p>
                                        Select Serve Next when a customer is
                                        waiting.
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="staff-action-buttons">
                            <button
                                type="button"
                                className="staff-serve-button"
                                onClick={() =>
                                    performQueueAction("serve-next")
                                }
                                disabled={
                                    actionLoading ||
                                    waitingCustomers.length === 0 ||
                                    Boolean(servingCustomer)
                                }
                            >
                                <span>▶</span>
                                {actionLoading
                                    ? "Processing..."
                                    : "Serve Next"}
                            </button>

                            <button
                                type="button"
                                className="staff-complete-button"
                                onClick={() =>
                                    performQueueAction("complete-current")
                                }
                                disabled={
                                    actionLoading ||
                                    !servingCustomer
                                }
                            >
                                <span>✓</span>
                                Complete Current
                            </button>
                        </div>
                    </section>

                    {/* Statistics */}
                    <section className="staff-stat-grid">
                        <article className="staff-stat-card">
                            <div className="staff-stat-top">
                                <span>Waiting Customers</span>
                                <span className="staff-stat-icon staff-stat-purple">
                                    ↻
                                </span>
                            </div>
                            <strong>{waitingCustomers.length}</strong>
                            <p>Customers in the waiting queue</p>
                        </article>

                        <article className="staff-stat-card">
                            <div className="staff-stat-top">
                                <span>Currently Serving</span>
                                <span className="staff-stat-icon staff-stat-cyan">
                                    ▶
                                </span>
                            </div>
                            <strong>{servingCustomer ? 1 : 0}</strong>
                            <p>Active counter service</p>
                        </article>

                        <article className="staff-stat-card">
                            <div className="staff-stat-top">
                                <span>Completed Today</span>
                                <span className="staff-stat-icon staff-stat-green">
                                    ✓
                                </span>
                            </div>
                            <strong>
                                {statistics?.completed_today ?? 0}
                            </strong>
                            <p>Customers served today</p>
                        </article>

                        <article className="staff-stat-card">
                            <div className="staff-stat-top">
                                <span>Average Service</span>
                                <span className="staff-stat-icon staff-stat-yellow">
                                    ◷
                                </span>
                            </div>
                            <strong>
                                {averageTime.toFixed(1)}
                                <small> min</small>
                            </strong>
                            <p>Average service time</p>
                        </article>
                    </section>

                    {/* Waiting queue */}
                    <section className="staff-queue-panel">
                        <div className="staff-panel-heading">
                            <div>
                                <span className="staff-eyebrow">
                                    CUSTOMER MANAGEMENT
                                </span>
                                <h3>Waiting Queue</h3>
                                <p>
                                    Customers waiting to be served, in token
                                    order.
                                </p>
                            </div>

                            <span className="staff-waiting-count">
                                {waitingCustomers.length} waiting
                            </span>
                        </div>

                        {waitingCustomers.length === 0 ? (
                            <div className="staff-queue-empty">
                                <span>✓</span>
                                <div>
                                    <strong>Queue is clear</strong>
                                    <p>
                                        There are no customers waiting at the
                                        moment.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="staff-table-wrapper">
                                <table className="staff-table">
                                    <thead>
                                        <tr>
                                            <th>QUEUE POSITION</th>
                                            <th>TOKEN</th>
                                            <th>CUSTOMER</th>
                                            <th>STATUS</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {waitingCustomers.map(
                                            (entry, index) => (
                                                <tr key={entry.id}>
                                                    <td>
                                                        <span className="staff-position">
                                                            {index + 1}
                                                        </span>
                                                    </td>

                                                    <td>
                                                        <strong className="staff-token-text">
                                                            #{entry.token_number}
                                                        </strong>
                                                    </td>

                                                    <td>
                                                        <div className="staff-customer-cell">
                                                            <span className="staff-customer-avatar">
                                                                {(
                                                                    entry.customer_name ||
                                                                    "C"
                                                                )
                                                                    .charAt(0)
                                                                    .toUpperCase()}
                                                            </span>

                                                            <strong>
                                                                {entry.customer_name}
                                                            </strong>
                                                        </div>
                                                    </td>

                                                    <td>
                                                        <span className="qs-status-badge qs-status-waiting">
                                                            <span className="qs-status-dot" />
                                                            Waiting
                                                        </span>
                                                    </td>
                                                </tr>
                                            )
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>

                    {/* Completed queue history */}
                    <section className="staff-queue-panel">
                        <div className="staff-panel-heading">
                            <div>
                                <span className="staff-eyebrow">
                                    SERVICE HISTORY
                                </span>
                                <h3>Recently Completed</h3>
                                <p>
                                    Completed entries currently available in
                                    the queue history.
                                </p>
                            </div>

                            <span className="staff-waiting-count">
                                {completedCustomers.length} completed
                            </span>
                        </div>

                        {completedCustomers.length === 0 ? (
                            <div className="staff-queue-empty">
                                <span>◷</span>
                                <div>
                                    <strong>No completed entries</strong>
                                    <p>
                                        Completed customers will appear here.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="staff-table-wrapper">
                                <table className="staff-table">
                                    <thead>
                                        <tr>
                                            <th>TOKEN</th>
                                            <th>CUSTOMER</th>
                                            <th>STATUS</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {[...completedCustomers]
                                            .reverse()
                                            .slice(0, 5)
                                            .map((entry) => (
                                                <tr key={entry.id}>
                                                    <td>
                                                        <strong className="staff-token-text">
                                                            #{entry.token_number}
                                                        </strong>
                                                    </td>

                                                    <td>
                                                        <div className="staff-customer-cell">
                                                            <span className="staff-customer-avatar">
                                                                {(
                                                                    entry.customer_name ||
                                                                    "C"
                                                                )
                                                                    .charAt(0)
                                                                    .toUpperCase()}
                                                            </span>

                                                            <strong>
                                                                {entry.customer_name}
                                                            </strong>
                                                        </div>
                                                    </td>

                                                    <td>
                                                        <span className="qs-status-badge qs-status-completed">
                                                            <span className="qs-status-dot" />
                                                            Completed
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                </>
            )}
        </div>
    );
}

export default StaffDashboard;