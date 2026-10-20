import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const socket = io(API_URL);

function QueueStatus({ services, refreshTrigger, tokenNumber }) {
    const [queue, setQueue] = useState([]);
    const [queueService, setQueueService] = useState("");
    const [averageServiceTime, setAverageServiceTime] = useState(5);
    const [notification, setNotification] = useState("");

    const notificationTimer = useRef(null);
    const notificationId = useRef(0);

    const fetchQueue = (serviceId) => {
        if (!serviceId) {
            setQueue([]);
            return;
        }

        fetch(`${API_URL}/api/queue/${serviceId}`)
            .then((response) => {
                if (!response.ok) {
                    throw new Error("Failed to fetch queue");
                }
                return response.json();
            })
            .then(setQueue)
            .catch((error) => {
                console.error("Error fetching queue:", error);
            });
    };

    const fetchStatistics = (serviceId) => {
        if (!serviceId) {
            setAverageServiceTime(5);
            return;
        }

        const token = localStorage.getItem("token");

        fetch(
            `${API_URL}/api/queue/${serviceId}/statistics`,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            }
        )
            .then((response) => {
                if (!response.ok) {
                    throw new Error("Failed to fetch queue statistics");
                }
                return response.json();
            })
            .then((data) => {
                const avgTime = Number(data.average_service_time);
                setAverageServiceTime(avgTime > 0 ? avgTime : 5);
            })
            .catch((error) => {
                console.error("Error fetching queue statistics:", error);
                setAverageServiceTime(5);
            });
    };

    const refreshQueueData = (serviceId) => {
        fetchQueue(serviceId);
        fetchStatistics(serviceId);
    };

    useEffect(() => {
        if (queueService) {
            refreshQueueData(queueService);
        }
    }, [refreshTrigger]);

    useEffect(() => {
        if (!tokenNumber || services.length === 0) {
            return;
        }

        let cancelled = false;

        const findCustomerService = async () => {
            for (const service of services) {
                try {
                    const response = await fetch(
                        `${API_URL}/api/queue/${service.id}`
                    );

                    if (!response.ok) continue;

                    const data = await response.json();

                    const customer = data.find(
                        (entry) =>
                            Number(entry.token_number) === Number(tokenNumber)
                    );

                    if (customer && !cancelled) {
                        setQueueService(String(service.id));
                        setQueue(data);
                        fetchStatistics(service.id);
                        break;
                    }
                } catch (error) {
                    console.error("Error finding customer service:", error);
                }
            }
        };

        findCustomerService();

        return () => {
            cancelled = true;
        };
    }, [tokenNumber, services]);

    useEffect(() => {
        const handleConnect = () => {
            console.log("Socket.IO connected:", socket.id);
        };

        const handleDisconnect = () => {
            console.log("Socket.IO disconnected");
        };

        socket.on("connect", handleConnect);
        socket.on("disconnect", handleDisconnect);

        return () => {
            socket.off("connect", handleConnect);
            socket.off("disconnect", handleDisconnect);
        };
    }, []);

    const showNotification = (message) => {
        notificationId.current += 1;
        const currentNotificationId = notificationId.current;

        if (notificationTimer.current) {
            clearTimeout(notificationTimer.current);
        }

        setNotification(message);

        notificationTimer.current = setTimeout(() => {
            if (notificationId.current === currentNotificationId) {
                setNotification("");
                notificationTimer.current = null;
            }
        }, 15000);
    };

    useEffect(() => {
        let cancelled = false;

        const handleQueueUpdated = async (data) => {
            try {
                const response = await fetch(
                    `${API_URL}/api/queue/${data.serviceId}`
                );

                if (!response.ok) {
                    throw new Error("Failed to fetch updated queue");
                }

                const updatedQueue = await response.json();

                if (cancelled) return;

                setQueueService((currentService) => {
                    if (
                        currentService &&
                        Number(currentService) !== Number(data.serviceId)
                    ) {
                        return currentService;
                    }

                    return String(data.serviceId);
                });

                setQueue((currentQueue) => {
                    if (
                        queueService &&
                        Number(queueService) !== Number(data.serviceId)
                    ) {
                        return currentQueue;
                    }

                    return updatedQueue;
                });

                fetchStatistics(data.serviceId);

                if (!tokenNumber) return;

                if (
                    queueService &&
                    Number(queueService) !== Number(data.serviceId)
                ) {
                    return;
                }

                const customer = updatedQueue.find(
                    (entry) =>
                        Number(entry.token_number) === Number(tokenNumber)
                );

                if (!customer) return;

                let message = "";

                if (customer.status === "serving") {
                    message = `🔔 Your token #${customer.token_number} is now being served!`;
                } else if (customer.status === "completed") {
                    message = `✅ Your token #${customer.token_number} has been completed.`;
                } else {
                    const peopleAhead = updatedQueue.filter(
                        (entry) =>
                            Number(entry.token_number) <
                            Number(customer.token_number) &&
                            (entry.status === "waiting" ||
                                entry.status === "serving")
                    ).length;

                    message =
                        peopleAhead <= 2
                            ? `🔔 Your turn is approaching! Only ${peopleAhead} ${peopleAhead === 1 ? "person" : "people"
                            } ahead of you.`
                            : `🔔 Queue updated for your token #${customer.token_number}`;
                }

                showNotification(message);
            } catch (error) {
                console.error("Error handling real-time queue update:", error);
            }
        };

        socket.on("queueUpdated", handleQueueUpdated);

        return () => {
            cancelled = true;
            socket.off("queueUpdated", handleQueueUpdated);
        };
    }, [tokenNumber, queueService]);

    useEffect(() => {
        return () => {
            notificationId.current += 1;

            if (notificationTimer.current) {
                clearTimeout(notificationTimer.current);
                notificationTimer.current = null;
            }
        };
    }, []);

    const currentCustomer = queue.find(
        (entry) =>
            Number(entry.token_number) === Number(tokenNumber)
    );

    const servingCustomer = queue.find(
        (entry) => entry.status === "serving"
    );

    const waitingCustomers = queue.filter(
        (entry) => entry.status === "waiting"
    );

    let peopleAhead = 0;
    let estimatedWait = 0;
    let position = 0;

    if (currentCustomer) {
        peopleAhead = queue.filter(
            (entry) =>
                Number(entry.token_number) <
                Number(currentCustomer.token_number) &&
                (entry.status === "waiting" || entry.status === "serving")
        ).length;

        position = peopleAhead + 1;
        estimatedWait = peopleAhead * averageServiceTime;
    }

    const getStatusClass = (status) => {
        if (status === "serving") return "qs-status-serving";
        if (status === "completed") return "qs-status-completed";
        return "qs-status-waiting";
    };

    return (
        <div className="qs-container">
            {notification && (
                <div
                    className="qs-notification"
                    role="status"
                    aria-live="polite"
                >
                    <span className="qs-notification-icon">✦</span>
                    <strong>{notification}</strong>
                </div>
            )}

            <div className="qs-service-selector">
                <label htmlFor="queue-status-service">
                    Monitor service
                </label>

                <select
                    id="queue-status-service"
                    value={queueService}
                    onChange={(event) => {
                        const serviceId = event.target.value;
                        setQueueService(serviceId);
                        refreshQueueData(serviceId);
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

            {!queueService ? (
                <div className="qs-empty-state">
                    <div className="qs-empty-icon">☷</div>
                    <h3>Your queue at a glance</h3>
                    <p>Select a service above to view its live queue.</p>
                </div>
            ) : (
                <>
                    {currentCustomer && (
                        <div className="qs-personal-card">
                            <div className="qs-personal-top">
                                <div>
                                    <span className="qs-kicker">
                                        YOUR QUEUE PASS
                                    </span>

                                    <h3>Your Queue Information</h3>

                                    <p>
                                        Keep an eye on your position while
                                        you wait.
                                    </p>
                                </div>

                                <div className="qs-token">
                                    <span>TOKEN</span>
                                    <strong>
                                        #{currentCustomer.token_number}
                                    </strong>
                                </div>
                            </div>

                            <div className="qs-personal-status">
                                <span className="qs-muted-label">
                                    Current status
                                </span>

                                <span
                                    className={`qs-status-badge ${getStatusClass(
                                        currentCustomer.status
                                    )}`}
                                >
                                    <span className="qs-status-dot" />
                                    {currentCustomer.status}
                                </span>
                            </div>

                            {currentCustomer.status === "waiting" && (
                                <div className="qs-metrics-grid">
                                    <div className="qs-metric">
                                        <span>People ahead</span>
                                        <strong>{peopleAhead}</strong>
                                    </div>

                                    <div className="qs-metric">
                                        <span>Queue position</span>
                                        <strong>#{position}</strong>
                                    </div>

                                    <div className="qs-metric">
                                        <span>Average service</span>
                                        <strong>
                                            {averageServiceTime.toFixed(1)}
                                            <small> min</small>
                                        </strong>
                                    </div>

                                    <div className="qs-metric qs-metric-highlight">
                                        <span>Estimated wait</span>
                                        <strong>
                                            ~{estimatedWait.toFixed(0)}
                                            <small> min</small>
                                        </strong>
                                    </div>
                                </div>
                            )}

                            {currentCustomer.status === "serving" && (
                                <div className="qs-message qs-message-success">
                                    <span>✦</span>
                                    <div>
                                        <strong>It's your turn!</strong>
                                        <p>
                                            Please proceed to the service
                                            counter.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {currentCustomer.status === "completed" && (
                                <div className="qs-message qs-message-success">
                                    <span>✓</span>
                                    <div>
                                        <strong>Service completed</strong>
                                        <p>
                                            Your queue service has been
                                            completed successfully.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="qs-live-heading">
                        <div>
                            <span className="qs-kicker">LIVE MONITOR</span>
                            <h3>Queue activity</h3>
                        </div>

                        <span className="qs-live-badge">
                            <span className="qs-status-dot" />
                            Live updates
                        </span>
                    </div>

                    <div className="qs-queue-overview">
                        <article className="qs-overview-item">
                            <span className="qs-overview-icon qs-purple">
                                ↻
                            </span>
                            <div>
                                <span>Waiting</span>
                                <strong>{waitingCustomers.length}</strong>
                            </div>
                        </article>

                        <article className="qs-overview-item">
                            <span className="qs-overview-icon qs-cyan">
                                ▶
                            </span>
                            <div>
                                <span>Serving</span>
                                <strong>{servingCustomer ? 1 : 0}</strong>
                            </div>
                        </article>

                        <article className="qs-overview-item">
                            <span className="qs-overview-icon qs-green">
                                ✓
                            </span>
                            <div>
                                <span>Completed</span>
                                <strong>
                                    {
                                        queue.filter(
                                            (entry) =>
                                                entry.status === "completed"
                                        ).length
                                    }
                                </strong>
                            </div>
                        </article>
                    </div>

                    <div className="qs-section">
                        <div className="qs-section-heading">
                            <h3>Currently serving</h3>
                            <span className="qs-section-count">
                                {servingCustomer ? "1 active" : "No active service"}
                            </span>
                        </div>

                        {servingCustomer ? (
                            <div className="qs-serving-card">
                                <div className="qs-serving-token">
                                    #{servingCustomer.token_number}
                                </div>

                                <div className="qs-serving-details">
                                    <strong>
                                        {servingCustomer.customer_name}
                                    </strong>
                                    <span>Being served now</span>
                                </div>

                                <span className="qs-status-badge qs-status-serving">
                                    <span className="qs-status-dot" />
                                    Serving
                                </span>
                            </div>
                        ) : (
                            <div className="qs-empty-row">
                                <span className="qs-empty-row-icon">◷</span>
                                <div>
                                    <strong>No active service</strong>
                                    <p>
                                        The counter is ready for the next
                                        customer.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="qs-section">
                        <div className="qs-section-heading">
                            <h3>Waiting queue</h3>

                            <span className="qs-section-count">
                                {waitingCustomers.length} waiting
                            </span>
                        </div>

                        {waitingCustomers.length === 0 ? (
                            <div className="qs-empty-row">
                                <span className="qs-empty-row-icon">✓</span>
                                <div>
                                    <strong>All caught up!</strong>
                                    <p>
                                        There are no customers waiting in this
                                        queue.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="qs-table-wrapper">
                                <table className="qs-table">
                                    <thead>
                                        <tr>
                                            <th>Token</th>
                                            <th>Customer</th>
                                            <th>Status</th>
                                            <th>Position</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {waitingCustomers.map(
                                            (entry, index) => (
                                                <tr key={entry.id}>
                                                    <td>
                                                        <strong className="qs-table-token">
                                                            #
                                                            {entry.token_number}
                                                        </strong>
                                                    </td>

                                                    <td>
                                                        <div className="qs-table-customer">
                                                            <span className="qs-customer-avatar">
                                                                {(
                                                                    entry.customer_name ||
                                                                    "C"
                                                                )
                                                                    .charAt(0)
                                                                    .toUpperCase()}
                                                            </span>

                                                            <span>
                                                                {entry.customer_name}
                                                            </span>
                                                        </div>
                                                    </td>

                                                    <td>
                                                        <span
                                                            className={`qs-status-badge ${getStatusClass(
                                                                entry.status
                                                            )}`}
                                                        >
                                                            <span className="qs-status-dot" />
                                                            {entry.status}
                                                        </span>
                                                    </td>

                                                    <td>
                                                        <span className="qs-position">
                                                            {index + 1}
                                                        </span>
                                                    </td>
                                                </tr>
                                            )
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

export default QueueStatus;