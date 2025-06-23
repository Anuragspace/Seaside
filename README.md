# Seaside 🎙️

A modern podcast platform with cloud support, real-time video chat, and seamless collaboration.

[![Frontend Deploy](https://img.shields.io/badge/Frontend-Live-green?logo=vercel)](https://seasides.vercel.app/) | [![Frontend Live on Vercel](https://img.shields.io/badge/Frontend-Live-green?logo=vercel)](https://seasides.vercel.app/) | [![Frontend on Vercel](https://img.shields.io/badge/Frontend-Live-green?logo=vercel)](https://seasides.vercel.app/)

---

## 🚀 Project Overview

**Seaside** is an open-source podcasting platform that allows users to create, join, and record podcasts with live video chat and cloud-based storage. Leveraging WebRTC for real-time communication and cloud technologies for scalability, Seaside is built for the modern creator and their audience.

---

## 🌐 Live Project

- **Frontend:** [https://seasides.vercel.app/](https://seasides.vercel.app/)

---

## 🛠️ Tech Stack

- **Frontend:** React, TypeScript, Vite
- **Backend:** Go (Fiber, WebSocket)
- **Real-time Communication:** WebRTC
- **Deployment:** Vercel (frontend), Render (backend)
- **Other:** Docker, GitHub Actions (CI/CD)

---

## 💡 Core Features

- 🎥 **1-on-1 Video Chat:** Secure, low-latency peer-to-peer video using WebRTC.
- 🗣️ **Room System:** Create and join podcast rooms with a unique ID.
- 💬 **Real-Time Signaling:** Fast signaling server using Go, Fiber, and WebSockets.
- ☁️ **Cloud Deployment:** Out-of-the-box support for Vercel and Render.
- 🚦 **Perfect Negotiation:** Handles WebRTC connection collisions and reconnections.
- 🔒 **CORS and Security:** Production-ready CORS and secure WebSocket handling.
- 📦 **Scalable Architecture:** Easily extend to group calls or add features.

---

## ✨ Usage

1. Visit the [Live Demo](https://seasides.vercel.app/).
2. Click **Create Room** to start a new podcast session.
3. Share the room ID with your collaborator.
4. Collaborator joins using the room ID.
5. Enjoy real-time video podcasting!

---

## 🏗️ Technologies Used

| Layer       | Technology                    |
|-------------|------------------------------|
| Frontend    | React, TypeScript, Vite      |
| Backend     | Go, Fiber, WebSocket         |
| Real-time   | WebRTC                       |
| Deployment  | Vercel, Render               |
| State Mgmt  | React Hooks, Context         |
| Styling     | CSS                          |
| CI/CD       | GitHub Actions               |

---

## 🚦 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/Anuragspace/Seaside.git
cd Seaside
```

### 2. Run Backend (Go + Fiber)

```bash
cd backend
go run main.go
```
By default, runs on `http://localhost:8080`.

### 3. Run Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```
By default, runs on `http://localhost:5173`.

**Set environment variables as needed for backend URL.**

---

## 📚 Folder Structure

```
Seaside/
├── backend/      # Go Fiber backend, WebRTC signaling
├── frontend/     # React + Vite frontend
└── README.md
```

---

## 📋 Contributing

Contributions are welcome! Please open an issue or pull request for suggestions and improvements.

---

## 📝 License

MIT License

---

**Made with ❤️ by [Anurag Adarsh](https://github.com/Anuragspace) and [Vibhu Airan](https://github.com/Vibhuair20).**
