import { useEffect, useState, useCallback } from "react";
import { io } from "socket.io-client";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const socket = io(API_URL);

function AdminDashboard() {
    // Existing dashboard state
    const [analytics, setAnalytics] = useState(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);

    // Completed customer history state
    const [completedHistory, setCompletedHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyError, setHistoryError] = useState("");

    // History filters
    const [serviceFilter, setServiceFilter] = useState("");
    const [dateFilter, setDateFilter] = useState("");
    const [historySearch, setHistorySearch] = useState("");

    // Fetch admin analytics
    const fetchAnalytics = useCallback(async () => {
        const token = localStorage.getItem("token");

        if (!token) {
            setError("Your session has expired. Please log in again.");
            setLoading(false);
            return;
        }

        try {
            const response = await fetch(
                `${API_URL}/api/admin/analytics`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            const data = await response.json();

            if (response.status === 401) {
                setError("Your session has expired. Please log in again.");
                setAnalytics(null);
                return;
            }

            if (response.status === 403) {
                setError(
                    "Access denied. Administrator permissions are required."
                );
                setAnalytics(null);
                return;
            }

            if (!response.ok) {
                throw new Error(
                    data.error || "Failed to fetch admin analytics."
                );
            }

            setAnalytics(data);
            setError("");
        } catch (err) {
            console.error("Error fetching admin analytics:", err);
            setError(err.message || "Failed to load admin analytics.");
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch completed customer history with filters
    const fetchCompletedHistory = useCallback(async () => {
        const token = localStorage.getItem("token");

        if (!token) {
            setHistoryError("Your session has expired. Please log in again.");
            setCompletedHistory([]);
            return;
        }

        setHistoryLoading(true);
        setHistoryError("");

        try {
            const params = new URLSearchParams();

            if (serviceFilter) {
                params.set("service_id", serviceFilter);
            }

            if (dateFilter) {
                params.set("date", dateFilter);
            }

            if (historySearch.trim()) {
                params.set("search", historySearch.trim());
            }

            const queryString = params.toString();

            const url = queryString
                ? `${API_URL}/api/admin/completed-history?${queryString}`
                : `${API_URL}/api/admin/completed-history`;

            const response = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const data = await response.json();

            if (response.status === 401) {
                throw new Error(
                    "Your session has expired. Please log in again."
                );
            }

            if (response.status === 403) {
                throw new Error(
                    "Administrator permissions are required to view history."
                );
            }

            if (!response.ok) {
                throw new Error(
                    data.error || "Failed to load completed history."
                );
            }

            if (!Array.isArray(data)) {
                throw new Error("Unexpected response from completed history API.");
            }

            setCompletedHistory(data);
        } catch (err) {
            console.error("Completed history error:", err);
            setHistoryError(
                err.message || "Failed to load completed customer history."
            );
            setCompletedHistory([]);
        } finally {
            setHistoryLoading(false);
        }
    }, [serviceFilter, dateFilter, historySearch]);

    // Initial analytics load
    useEffect(() => {
        fetchAnalytics();
    }, [fetchAnalytics]);

    // Load history and refresh when its filters change
    useEffect(() => {
        fetchCompletedHistory();
    }, [fetchCompletedHistory]);

    // Refresh data when queue activity changes
    useEffect(() => {
        const handleQueueUpdated = () => {
            fetchAnalytics();
            fetchCompletedHistory();
        };

        socket.on("queueUpdated", handleQueueUpdated);

        return () => {
            socket.off("queueUpdated", handleQueueUpdated);
        };
    }, [fetchAnalytics, fetchCompletedHistory]);

    // Clear history filters
    const clearHistoryFilters = () => {
        setServiceFilter("");
        setDateFilter("");
        setHistorySearch("");
    };

    // Format timestamps for display
    const formatDateTime = (value) => {
        if (!value) {
            return "—";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "—";
        }

        return date.toLocaleString();
    };

    // Initial loading screen
    if (loading) {
        return (
            <section className="admin-dashboard">
                <div className="admin-heading">
                    <span className="admin-eyebrow">SYSTEM ANALYTICS</span>
                    <h2>Admin Dashboard</h2>
                    <p>Loading your system analytics...</p>
                </div>
            </section>
        );
    }

    // Main analytics error
    if (error) {
        return (
            <section className="admin-dashboard">
                <div className="admin-heading">
                    <span className="admin-eyebrow">SYSTEM ANALYTICS</span>
                    <h2>Admin Dashboard</h2>
                </div>

                <div className="admin-error">
                    <span className="admin-error-icon">!</span>

                    <div>
                        <h3>Unable to load analytics</h3>
                        <p>{error}</p>

                        <button
                            type="button"
                            className="admin-retry-button"
                            onClick={fetchAnalytics}
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            </section>
        );
    }

    const dashboard = analytics?.dashboard;
    const services = analytics?.services || [];

    // Dashboard metric cards
    const metrics = [
        {
            label: "Total Services",
            value: dashboard?.total_services ?? 0,
            icon: "▦",
            theme: "purple",
        },
        {
            label: "Total Customers",
            value: dashboard?.total_customers ?? 0,
            icon: "♙",
            theme: "cyan",
        },
        {
            label: "Total Tokens Today",
            value: dashboard?.total_tokens_today ?? 0,
            icon: "▤",
            theme: "blue",
        },
        {
            label: "Waiting Now",
            value: dashboard?.waiting_now ?? 0,
            icon: "◷",
            theme: "yellow",
        },
        {
            label: "Currently Serving",
            value: dashboard?.currently_serving ?? 0,
            icon: "▶",
            theme: "cyan",
        },
        {
            label: "Completed Today",
            value: dashboard?.completed_today ?? 0,
            icon: "✓",
            theme: "green",
        },
        {
            label: "Average Service Time",
            value: `${dashboard?.average_service_time ?? 0} min`,
            icon: "◴",
            theme: "purple",
        },
    ];

    return (
        <section className="admin-dashboard">
            {/* Dashboard Header */}
            <div className="admin-heading">
                <div>
                    <span className="admin-eyebrow">
                        SYSTEM ANALYTICS
                    </span>

                    <h2>Admin Dashboard</h2>

                    <p>
                        System overview and real-time queue analytics.
                    </p>
                </div>

                <div className="admin-live-indicator">
                    <span />
                    Live System
                </div>
            </div>

            {/* System Overview */}
            <div className="admin-section-heading">
                <div>
                    <h3>System Overview</h3>
                    <p>Monitor your platform at a glance.</p>
                </div>
            </div>

            {/* Metric Cards */}
            <div className="admin-metrics-grid">
                {metrics.map((metric) => (
                    <article
                        className="admin-metric-card"
                        key={metric.label}
                    >
                        <div className="admin-metric-top">
                            <span>{metric.label}</span>

                            <span
                                className={`admin-metric-icon admin-icon-${metric.theme}`}
                            >
                                {metric.icon}
                            </span>
                        </div>

                        <strong className="admin-metric-value">
                            {metric.value}
                        </strong>

                        <span className="admin-metric-caption">
                            {metric.label === "Average Service Time"
                                ? "Average time per customer"
                                : metric.label === "Waiting Now"
                                    ? "Customers awaiting service"
                                    : metric.label === "Currently Serving"
                                        ? "Active counter services"
                                        : metric.label === "Completed Today"
                                            ? "Completed queue entries today"
                                            : "Across your QueueLess platform"}
                        </span>
                    </article>
                ))}
            </div>

            {/* Service-Wise Analytics */}
            <div className="admin-service-panel">
                <div className="admin-section-heading">
                    <div>
                        <span className="admin-eyebrow">
                            SERVICE PERFORMANCE
                        </span>

                        <h3>Service-wise Queue Analytics</h3>

                        <p>
                            Compare queue activity across your services.
                        </p>
                    </div>

                    <span className="admin-service-count">
                        {services.length} services
                    </span>
                </div>

                {services.length === 0 ? (
                    <div className="admin-no-services">
                        <span>▦</span>
                        <strong>No services available</strong>

                        <p>
                            Services will appear here when they are added
                            to QueueLess.
                        </p>
                    </div>
                ) : (
                    <div className="admin-table-wrapper">
                        <table className="admin-analytics-table">
                            <thead>
                                <tr>
                                    <th>Service</th>
                                    <th>Waiting</th>
                                    <th>Serving</th>
                                    <th>Total Tokens</th>
                                </tr>
                            </thead>

                            <tbody>
                                {services.map((service) => (
                                    <tr key={service.id}>
                                        <td>
                                            <div className="admin-service-name">
                                                <span className="admin-service-symbol">
                                                    ▦
                                                </span>

                                                <strong>
                                                    {service.name}
                                                </strong>
                                            </div>
                                        </td>

                                        <td>
                                            <span className="admin-number admin-number-waiting">
                                                {service.waiting_count ?? 0}
                                            </span>
                                        </td>

                                        <td>
                                            <span className="admin-number admin-number-serving">
                                                {service.serving_count ?? 0}
                                            </span>
                                        </td>

                                        <td>
                                            <strong className="admin-total-tokens">
                                                {service.total_tokens ?? 0}
                                            </strong>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Completed Customer History */}
            <div className="admin-service-panel admin-history-panel">
                <div className="admin-section-heading">
                    <div>
                        <span className="admin-eyebrow">
                            CUSTOMER RECORDS
                        </span>

                        <h3>Completed Customer History</h3>

                        <p>
                            Search, filter, and review completed queue entries.
                        </p>
                    </div>

                    <span className="admin-service-count">
                        {historyLoading
                            ? "Loading..."
                            : `${completedHistory.length} records`}
                    </span>
                </div>

                {/* History Filters */}
                <div className="admin-history-filters">
                    <input
                        type="search"
                        placeholder="Search customer or token..."
                        value={historySearch}
                        onChange={(event) =>
                            setHistorySearch(event.target.value)
                        }
                        aria-label="Search by customer name or token number"
                    />

                    <select
                        value={serviceFilter}
                        onChange={(event) =>
                            setServiceFilter(event.target.value)
                        }
                        aria-label="Filter by service"
                    >
                        <option value="">All services</option>

                        {services.map((service) => (
                            <option
                                key={service.id}
                                value={service.id}
                            >
                                {service.name}
                            </option>
                        ))}
                    </select>

                    <input
                        type="date"
                        value={dateFilter}
                        onChange={(event) =>
                            setDateFilter(event.target.value)
                        }
                        aria-label="Filter by completion date"
                        title="Filter by completion date"
                    />

                    <button
                        type="button"
                        className="admin-retry-button"
                        onClick={clearHistoryFilters}
                        disabled={
                            !serviceFilter &&
                            !dateFilter &&
                            !historySearch
                        }
                    >
                        Clear Filters
                    </button>
                </div>

                {/* History Error */}
                {historyError && (
                    <div className="admin-error" role="alert">
                        <div>
                            <h3>Unable to load customer history</h3>
                            <p>{historyError}</p>

                            <button
                                type="button"
                                className="admin-retry-button"
                                onClick={fetchCompletedHistory}
                                disabled={historyLoading}
                            >
                                Try Again
                            </button>
                        </div>
                    </div>
                )}

                {/* History Loading */}
                {!historyError && historyLoading && (
                    <div className="admin-no-services">
                        <p>Loading completed customer history...</p>
                    </div>
                )}

                {/* Empty History */}
                {!historyError &&
                    !historyLoading &&
                    completedHistory.length === 0 && (
                        <div className="admin-no-services">
                            <span>▤</span>
                            <strong>No completed records found</strong>

                            <p>
                                Try changing your search or filters.
                            </p>
                        </div>
                    )}

                {/* History Table */}
                {!historyError &&
                    !historyLoading &&
                    completedHistory.length > 0 && (
                        <div className="admin-table-wrapper">
                            <table className="admin-analytics-table">
                                <thead>
                                    <tr>
                                        <th>Token</th>
                                        <th>Customer</th>
                                        <th>Service</th>
                                        <th>Joined At</th>
                                        <th>Completed At</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {completedHistory.map((entry) => (
                                        <tr key={entry.id}>
                                            <td>
                                                <strong>
                                                    #{entry.token_number}
                                                </strong>
                                            </td>

                                            <td>
                                                {entry.customer_name}
                                            </td>

                                            <td>
                                                {entry.service_name}
                                            </td>

                                            <td>
                                                {formatDateTime(
                                                    entry.joined_at
                                                )}
                                            </td>

                                            <td>
                                                {formatDateTime(
                                                    entry.completed_at
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
            </div>

            <p className="admin-footer-note">
                QueueLess · System analytics
            </p>
        </section>
    );
}

export default AdminDashboard;