import { useEffect, useState } from "react";
import QueueStatus from "./components/QueueStatus";
import StaffDashboard from "./components/StaffDashboard";
import AdminDashboard from "./components/AdminDashboard";
import OverviewCharts from "./components/OverviewCharts";
import Login from "./components/Login";

function App() {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("user");
    const token = localStorage.getItem("token");

    if (!savedUser || !token) {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      return null;
    }

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));

      if (payload.exp * 1000 <= Date.now()) {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        return null;
      }

      return JSON.parse(savedUser);
    } catch {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      return null;
    }
  });

  const [services, setServices] = useState([]);
  const [name, setName] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [tokenNumber, setTokenNumber] = useState(null);
  const [error, setError] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [loadingServices, setLoadingServices] = useState(true);

  const fetchServices = () => {
    setLoadingServices(true);

    fetch("http://localhost:5000/api/services")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to load services.");
        }

        return response.json();
      })
      .then((data) => {
        setServices(data);
        setError("");
      })
      .catch((error) => {
        console.error("Error fetching services:", error);
        setError("Failed to load services.");
      })
      .finally(() => {
        setLoadingServices(false);
      });
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const handleJoinQueue = async (event) => {
    event.preventDefault();

    if (!name.trim() || !selectedService) {
      setError("Please enter your name and select a service.");
      return;
    }

    setError("");
    setTokenNumber(null);

    try {
      const response = await fetch("http://localhost:5000/api/queue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          service_id: Number(selectedService),
          customer_name: name.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to join queue.");
      }

      setTokenNumber(data.tokenNumber);
      setName("");
      setRefreshTrigger((value) => value + 1);
    } catch (error) {
      console.error("Error joining queue:", error);
      setError(error.message || "Unable to join the queue.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">Q</div>

          <div className="brand-text">
            <h2>QueueLess</h2>
            <span>Queue Management</span>
          </div>
        </div>

        <div className="sidebar-section-label">WORKSPACE</div>

        <nav className="sidebar-nav">
          <a href="#overview" className="nav-item active">
            <span className="nav-icon">◈</span>
            Overview
          </a>

          <a href="#join-queue" className="nav-item">
            <span className="nav-icon">＋</span>
            Join Queue
          </a>

          <a href="#queue-status" className="nav-item">
            <span className="nav-icon">☷</span>
            Queue Status
          </a>

          {(user.role === "staff" || user.role === "admin") && (
            <a href="#staff-dashboard" className="nav-item">
              <span className="nav-icon">▦</span>
              Staff Dashboard
            </a>
          )}

          {user.role === "admin" && (
            <a href="#admin-dashboard" className="nav-item">
              <span className="nav-icon">◫</span>
              Analytics
            </a>
          )}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-user">
            <div className="user-avatar">
              {(user.name || "U").charAt(0).toUpperCase()}
            </div>

            <div className="sidebar-user-info">
              <strong>{user.name}</strong>
              <span>{user.role}</span>
            </div>
          </div>

          <button
            type="button"
            className="logout-button"
            onClick={handleLogout}
          >
            ↪ <span>Log out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content" id="overview">
        <header className="topbar">
          <div>
            <div className="breadcrumb">Workspace / Overview</div>
            <h1>Operations Overview</h1>
            <p>Monitor your queue and manage customer flow.</p>
          </div>

          <div className="topbar-right">
            <div className="connection-indicator">
              <span className="connection-dot" />
              System dashboard
            </div>

            <div className="topbar-avatar">
              {(user.name || "U").charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Welcome banner */}
        <section className="welcome-banner">
          <div className="welcome-copy">
            <span className="eyebrow">YOUR WORKSPACE</span>

            <h2>Welcome back, {user.name} 👋</h2>

            <p>
              Here's your QueueLess workspace. Everything you need,
              in one place.
            </p>
          </div>

          <div className="welcome-decoration">
            <div className="decoration-ring ring-one" />
            <div className="decoration-ring ring-two" />
            <div className="decoration-orb">Q</div>
          </div>
        </section>

        {/* Status overview */}
        <section className="overview-grid">
          <article className="overview-card">
            <div className="overview-card-top">
              <span className="overview-label">Available Services</span>
              <span className="overview-icon purple-icon">▦</span>
            </div>

            <div className="overview-number">
              {loadingServices ? "—" : services.length}
            </div>

            <p>Services available in your workspace</p>
          </article>

          <article className="overview-card">
            <div className="overview-card-top">
              <span className="overview-label">Your Role</span>
              <span className="overview-icon cyan-icon">♙</span>
            </div>

            <div className="overview-role">{user.role}</div>

            <p>Your current access level</p>
          </article>

          <article className="overview-card">
            <div className="overview-card-top">
              <span className="overview-label">Platform Status</span>
              <span className="overview-icon green-icon">✓</span>
            </div>

            <div className="overview-role">QueueLess</div>

            <p>Queue management workspace</p>
          </article>
        </section>

        {/* Queue Activity Visualization */}
        <OverviewCharts />

        {/* Customer queue form */}
        <section className="panel join-panel" id="join-queue">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">GET STARTED</span>
              <h2>Join a queue</h2>
              <p>Choose a service and get your queue token.</p>
            </div>

            <span className="panel-heading-icon">＋</span>
          </div>

          <form className="join-form" onSubmit={handleJoinQueue}>
            <div className="form-field">
              <label htmlFor="customer-name">Your name</label>

              <input
                id="customer-name"
                type="text"
                placeholder="Enter your full name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>

            <div className="form-field">
              <label htmlFor="join-service">Select service</label>

              <select
                id="join-service"
                value={selectedService}
                onChange={(event) => setSelectedService(event.target.value)}
              >
                <option value="">Choose a service</option>

                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              className="primary-button join-button"
              type="submit"
              disabled={loadingServices}
            >
              Join Queue <span>→</span>
            </button>
          </form>

          {error && <div className="error-message">{error}</div>}

          {tokenNumber !== null && (
            <div className="token-success">
              <div>
                <span className="eyebrow">YOUR QUEUE TOKEN</span>
                <h3>You're in the queue!</h3>
                <p>Keep this token number for reference.</p>
              </div>

              <div className="token-number">#{tokenNumber}</div>
            </div>
          )}
        </section>

        {/* Queue status */}
        <section className="panel queue-panel" id="queue-status">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">LIVE TRACKING</span>
              <h2>Queue Status</h2>
              <p>Track your position and service progress.</p>
            </div>

            <span className="live-badge">
              <span className="connection-dot" />
              Live
            </span>
          </div>

          <QueueStatus
            services={services}
            refreshTrigger={refreshTrigger}
            tokenNumber={tokenNumber}
          />
        </section>

        {/* Staff dashboard */}
        {(user.role === "staff" || user.role === "admin") && (
          <section
            className="panel dashboard-panel"
            id="staff-dashboard"
          >
            <div className="panel-heading">
              <div>
                <span className="eyebrow">QUEUE OPERATIONS</span>
                <h2>Staff Dashboard</h2>
                <p>Manage waiting customers and service progress.</p>
              </div>
            </div>

            <StaffDashboard services={services} />
          </section>
        )}

        {/* Admin dashboard */}
        {user.role === "admin" && (
          <section
            className="panel dashboard-panel"
            id="admin-dashboard"
          >
            <div className="panel-heading">
              <div>
                <span className="eyebrow">SYSTEM INSIGHTS</span>
                <h2>Admin Analytics</h2>
                <p>Review platform activity and service performance.</p>
              </div>
            </div>

            <AdminDashboard />
          </section>
        )}

        {/* Available services */}
        <section className="services-section">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">EXPLORE</span>
              <h2>Available Services</h2>
              <p>Select the service you need.</p>
            </div>
          </div>

          {loadingServices ? (
            <div className="empty-state">Loading services...</div>
          ) : services.length === 0 ? (
            <div className="empty-state">
              No services available at the moment.
            </div>
          ) : (
            <div className="services-grid">
              {services.map((service, index) => (
                <article className="service-card" key={service.id}>
                  <div className={`service-icon service-icon-${index % 4}`}>
                    {["▦", "⌂", "☕", "✦"][index % 4]}
                  </div>

                  <h3>{service.name}</h3>

                  <p>
                    {service.description || "Queue management service"}
                  </p>

                  <button
                    type="button"
                    className="service-link"
                    onClick={() => {
                      setSelectedService(String(service.id));
                      document
                        .getElementById("join-queue")
                        ?.scrollIntoView({
                          behavior: "smooth",
                          block: "center",
                        });
                    }}
                  >
                    Select service <span>→</span>
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="app-footer">
          <div className="footer-brand">
            <span className="footer-logo">Q</span>
            <strong>QueueLess</strong>
          </div>

          <span>Smarter queues. Better experiences.</span>

          <span>© {new Date().getFullYear()} QueueLess</span>
        </footer>
      </main>
    </div>
  );
}

export default App;