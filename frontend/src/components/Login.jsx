import { useState } from "react";

function Login({ onLogin }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [name, setName] = useState("");
    const handleLogin = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const response = await fetch(
                "http://localhost:5000/api/auth/login",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ email, password }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || "Login failed.");
                return;
            }

            localStorage.setItem("token", data.token);
            localStorage.setItem("user", JSON.stringify(data.user));

            onLogin(data.user);
        } catch {
            setError("Unable to connect to server. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleSignUp = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const response = await fetch(
                "http://localhost:5000/api/auth/register",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        name,
                        email,
                        password,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || "Registration failed.");
                return;
            }

            setIsSignUp(false);
            setName("");
            setEmail("");
            setPassword("");
            setError("");
        } catch {
            setError("Unable to connect to server. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="login-page">
            <div className="login-glow login-glow-one" />
            <div className="login-glow login-glow-two" />

            <section className="login-card">
                <div className="login-card-handle" />

                <div className="login-brand">
                    <div className="login-logo">Q</div>
                    <span>QueueLess</span>
                </div>

                <div className="login-heading">
                    <h1>{isSignUp ? "Create Account" : "Welcome Back"}</h1>
                    <p>
                        {isSignUp
                            ? "Sign up to start managing your queue."
                            : "Sign in to manage your queue."}
                    </p>
                </div>

                <form onSubmit={isSignUp ? handleSignUp : handleLogin}>
                    {isSignUp && (
                        <div className="login-field">
                            <label htmlFor="signup-name">Full Name</label>

                            <div className="login-input-wrapper">
                                <span className="login-input-icon">♙</span>

                                <input
                                    id="signup-name"
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Enter your full name"
                                    autoComplete="name"
                                    maxLength={100}
                                    required
                                />
                            </div>
                        </div>
                    )}
                    <div className="login-field">
                        <label htmlFor="login-email">Email Address</label>

                        <div className="login-input-wrapper">
                            <span className="login-input-icon">✉</span>

                            <input
                                id="login-email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter your email"
                                autoComplete="username"
                                required
                            />
                        </div>
                    </div>

                    <div className="login-field">
                        <label htmlFor="login-password">Password</label>

                        <div className="login-input-wrapper">
                            <span className="login-input-icon">♙</span>

                            <input
                                id="login-password"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                autoComplete="current-password"
                                required
                            />

                            <button
                                type="button"
                                className="login-password-toggle"
                                onClick={() =>
                                    setShowPassword((previous) => !previous)
                                }
                                aria-label={
                                    showPassword
                                        ? "Hide password"
                                        : "Show password"
                                }
                            >
                                {showPassword ? "Hide" : "Show"}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="login-error" role="alert">
                            <span>!</span>
                            {error}
                        </div>
                    )}

                    <button
                        className="login-submit"
                        type="submit"
                        disabled={loading}
                    >
                        {loading
                            ? (isSignUp ? "Creating account..." : "Signing in...")
                            : (isSignUp ? "Create Account" : "Sign In")}
                        {!loading && <span> →</span>}
                    </button>
                </form>

                <p className="login-footer">
                    QueueLess <span>·</span> Smart Queue Management
                </p>
                <div className="login-switch">
                    {isSignUp ? "Already have an account?" : "New to QueueLess?"}

                    <button
                        type="button"
                        onClick={() => {
                            setIsSignUp((previous) => !previous);
                            setError("");
                            setName("");
                            setEmail("");
                            setPassword("");
                        }}
                    >
                        {isSignUp ? "Sign In" : "Create Account"}
                    </button>
                </div>
            </section>
        </main>
    );
}

export default Login;