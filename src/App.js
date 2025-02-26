import React, { useState, useEffect } from "react";
import { HashRouter as Router } from "react-router-dom";

const App = () => {
  const [user, setUser] = useState(null);
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [dropboxes, setDropboxes] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const transactionsPerPage = 10;

  useEffect(() => {
    const fetchData = async () => {
      const usersRes = await fetch("/users.csv");
      const usersText = await usersRes.text();
      const usersArray = usersText.split("\n").slice(1).map(line => {
        const [userId, name, email, phone, role] = line.split(",");
        return { userId, name, email, phone, role };
      });
      setUsers(usersArray);

      const transactionsRes = await fetch("/transactions.csv");
      const transactionsText = await transactionsRes.text();
      const transactionsArray = transactionsText.split("\n").slice(1).map(line => {
        const [transactionId, dateTime, dropboxId, userId, bottlesDisposed] = line.split(",");
        return { transactionId, dateTime: new Date(dateTime), dropboxId, userId, bottlesDisposed: Number(bottlesDisposed) };
      });
      setTransactions(transactionsArray);

      const dropboxesRes = await fetch("/dropboxes.csv");
      const dropboxesText = await dropboxesRes.text();
      const dropboxesArray = dropboxesText.split("\n").slice(1).map(line => {
        const [dropboxId, userId, location, description] = line.split(",");
        return { dropboxId, userId, location, description };
      });
      setDropboxes(dropboxesArray);
    };

    fetchData();
  }, []);

  const handleLogin = () => {
    const foundUser = users.find(u => u.userId === userId);
    if (foundUser) {
      setUser(foundUser);
      setError("");
    } else {
      setError("Invalid credentials");
    }
  };

  if (!user) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <div style={{ border: "1px solid #ddd", padding: "20px", width: "300px", borderRadius: "10px" }}>
          <h2>Login</h2>
          <input type="text" placeholder="User ID" value={userId} onChange={e => setUserId(e.target.value)} style={{ width: "100%", padding: "8px", marginBottom: "10px" }} />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: "100%", padding: "8px", marginBottom: "10px" }} />
          {error && <p style={{ color: "red" }}>{error}</p>}
          <button onClick={handleLogin} style={{ width: "100%", padding: "10px", backgroundColor: "#28a745", color: "white", border: "none", borderRadius: "5px" }}>Login</button>
        </div>
      </div>
    );
  }

  let filteredTransactions = [];
  let totalBottles = 0;
  let amountEarned = 0;
  let recyclerData = {};
  const today = new Date();
  const last12Months = Array.from({ length: 12 }, (_, i) => {
    const date = new Date();
    date.setMonth(today.getMonth() - i);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }).reverse();

  if (user.role === "participant") {
    filteredTransactions = transactions.filter(t => t.userId === user.userId);
    totalBottles = filteredTransactions.reduce((sum, t) => sum + t.bottlesDisposed, 0);
    amountEarned = totalBottles * 0.1;
  } else if (user.role === "dropbox") {
    const dropbox = dropboxes.find(d => d.userId === user.userId);
    if (dropbox) {
      filteredTransactions = transactions.filter(t => t.dropboxId === dropbox.dropboxId);
      totalBottles = filteredTransactions.reduce((sum, t) => sum + t.bottlesDisposed, 0);
      amountEarned = totalBottles * 0.1;
    }
  } else if (user.role === "recycler") {
    transactions.forEach(t => {
      if (!t.dropboxId) return; // Ignore undefined dropbox IDs
      const date = new Date(t.dateTime);
      const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

      if (!recyclerData[t.dropboxId]) {
        recyclerData[t.dropboxId] = Object.fromEntries(last12Months.map(m => [m, 0])); // Ensure 12 months appear
      }

      recyclerData[t.dropboxId][yearMonth] += t.bottlesDisposed;
    });
  }

  const indexOfLastTransaction = currentPage * transactionsPerPage;
  const indexOfFirstTransaction = indexOfLastTransaction - transactionsPerPage;
  const paginatedTransactions = filteredTransactions.slice(indexOfFirstTransaction, indexOfLastTransaction);

  return (
    <div style={{ padding: "20px" }}>
      <h2>Dashboard</h2>
      <p>Welcome, {user.name} ({user.role})</p>

      {user.role === "recycler" ? (
        <>
          <h3>Total Bottles Collected per Dropbox (Last 12 Months)</h3>
          <table border="1" cellPadding="5" style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th>Dropbox ID</th>
                {last12Months.map(month => <th key={month}>{month}</th>)}
              </tr>
            </thead>
            <tbody>
              {Object.entries(recyclerData).map(([dropboxId, months]) => (
                <tr key={dropboxId}>
                  <td>{dropboxId}</td>
                  {last12Months.map(month => <td key={month}>{months[month]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <>
          <p><strong>Total Bottles:</strong> {totalBottles}</p>
          <p><strong>Amount Earned:</strong> ${amountEarned.toFixed(2)}</p>

          <h3>Transactions</h3>
          <table border="1" cellPadding="5" style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th>Transaction ID</th>
                <th>Date</th>
                {!user.role.includes("dropbox") && <th>Dropbox ID</th>}
                {!user.role.includes("participant") && <th>User ID</th>}
                <th>Bottles Disposed</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {paginatedTransactions.map(t => (
                <tr key={t.transactionId}>
                  <td>{t.transactionId}</td>
                  <td>{t.dateTime.toISOString().split("T")[0]}</td>
                  {!user.role.includes("dropbox") && <td>{t.dropboxId || "-"}</td>}
                  {!user.role.includes("participant") && <td>{t.userId || "-"}</td>}
                  <td>{t.bottlesDisposed}</td>
                  <td>${(t.bottlesDisposed * 0.1).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}>Prev</button>
          <button onClick={() => setCurrentPage(prev => prev + 1)}>Next</button>
        </>
      )}

      <button onClick={() => setUser(null)}>Logout</button>
    </div>
  );
};

export default App;
