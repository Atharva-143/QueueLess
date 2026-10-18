import { useEffect, useState } from "react";
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
} from "recharts";
import { io } from "socket.io-client";

const API_URL = "http://localhost:5000";

function OverviewCharts() {
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const socket = io(API_URL);
        let isMounted = true;

        const fetchQueueActivity = async () => {
            try {
                const servicesResponse = await fetch(
                    `${API_URL}/api/services`
                );

                if (!servicesResponse.ok) {
                    throw new Error("Unable to load services.");
                }

                const allServices = await servicesResponse.json();

                const activeServices = allServices.filter(
                    (service) => Number(service.is_active) === 1
                );

                const serviceData = await Promise.all(
                    activeServices.map(async (service) => {
                        const queueResponse = await fetch(
                            `${API_URL}/api/queue/${service.id}`
                        );

                        if (!queueResponse.ok) {
                            throw new Error("Unable to load queue data.");
                        }

                        const queue = await queueResponse.json();

                        const waiting = queue.filter(
                            (customer) => customer.status === "waiting"
                        ).length;

                        return {
                            name: service.name,
                            waiting,
                        };
                    })
                );

                if (isMounted) {
                    setServices(serviceData);
                    setError("");
                }
            } catch (err) {
                console.error("Overview chart error:", err);

                if (isMounted) {
                    setError("Queue activity is temporarily unavailable.");
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchQueueActivity();

        socket.on("queueUpdated", fetchQueueActivity);

        return () => {
            isMounted = false;
            socket.off("queueUpdated", fetchQueueActivity);
            socket.disconnect();
        };
    }, []);

    return (
        <section className="overview-charts">
            <div className="charts-heading">
                <div>
                    <span className="eyebrow">LIVE OPERATIONS</span>
                    <h2>Queue Activity</h2>
                    <p>
                        Compare waiting customers across your services.
                    </p>
                </div>

                <span className="charts-badge">Service overview</span>
            </div>

            <div className="chart-card">
                {loading ? (
                    <p className="chart-message">
                        Loading queue activity...
                    </p>
                ) : error ? (
                    <p className="chart-message">{error}</p>
                ) : services.length === 0 ? (
                    <p className="chart-message">
                        No service data is available yet.
                    </p>
                ) : (
                    <div className="chart-container">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={services}
                                margin={{
                                    top: 12,
                                    right: 12,
                                    left: -18,
                                    bottom: 8,
                                }}
                            >
                                <CartesianGrid
                                    stroke="#26364c"
                                    strokeDasharray="4 4"
                                    vertical={false}
                                />

                                <XAxis
                                    dataKey="name"
                                    tick={{
                                        fill: "#a9bdd6",
                                        fontSize: 11,
                                    }}
                                    axisLine={{ stroke: "#293950" }}
                                    tickLine={false}
                                />

                                <YAxis
                                    allowDecimals={false}
                                    tick={{
                                        fill: "#8fa6c2",
                                        fontSize: 11,
                                    }}
                                    axisLine={false}
                                    tickLine={false}
                                />

                                <Tooltip
                                    contentStyle={{
                                        background: "#111c2d",
                                        border: "1px solid #354761",
                                        borderRadius: "10px",
                                        color: "#f8fafc",
                                    }}
                                    labelStyle={{
                                        color: "#c4b5fd",
                                    }}
                                    cursor={{
                                        fill: "rgba(139, 92, 246, 0.08)",
                                    }}
                                />

                                <Bar
                                    dataKey="waiting"
                                    name="Waiting customers"
                                    fill="#8b7cff"
                                    radius={[6, 6, 0, 0]}
                                    maxBarSize={64}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </section>
    );
}

export default OverviewCharts;