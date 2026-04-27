<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# 🚀 Maktab Waliullah Chattergam

A robust, high-performance platform built with **React**, **Vite**, and **TypeScript**. This project features a redefined user interface and is engineered for real-time data management using **Firebase**.

[**Live Demo**](https://maktabwaliulaserchattergam.vercel.app) | [**AI Studio Workspace**](https://ai.studio/apps/4a1e6e1e-cea3-4703-9620-3839dc96d173)

---

## 💎 Latest Version: Redefined UI
The latest release focuses on a complete visual overhaul and performance optimization:
* **UI/UX:** Fully redefined interface with fixed layout errors.
* **Architecture:** Migration to the latest dependencies for better stability.
* **Performance:** Optimized Firestore queries with composite indexes and data limits.
* **Type Safety:** Full TypeScript implementation for scalable development.

---

## 🛠️ Technical Stack
* **Frontend:** React 18 + Vite (TypeScript)
* **Backend:** Firebase (Authentication & Firestore)
* **Configuration:** Metadata-driven architecture via `metadata.json` and `firebase-blueprint.json`.

---

## ⚙️ Local Development

**Prerequisites:** [Node.js](https://nodejs.org/)

1.  **Clone & Install:**
    ```bash
    git clone [https://github.com/zeeshanmaqbool200/maktabwaliulaserchattergam.git](https://github.com/zeeshanmaqbool200/maktabwaliulaserchattergam.git)
    cd maktabwaliulaserchattergam
    npm install
    ```

2.  **Environment Setup:**
    Create a `.env.local` file in the root directory:
    ```env
    VITE_FIREBASE_API_KEY=your_key
    VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
    VITE_FIREBASE_PROJECT_ID=your_project_id
    VITE_GEMINI_API_KEY=your_gemini_key
    ```

3.  **Launch:**
    ```bash
    npm run dev
    ```

---

## 📂 Database & Security
Ensure your Firestore environment is configured using the provided rule-sets:
* **Rules:** Defined in `firestore.rules`.
* **Indexes:** Optimized via `firestore.indexes.json` and documented in `FIRESTORE_INDEXES.md`.

---

## 📱 Mobile Build (APK)
This repository is structure-ready for mobile wrapping:
1.  **Build:** Run `npm run build` to generate production assets.
2.  **Sync:** Use `npx cap sync` to update the native project.
3.  **Compile:** Open the `android` folder in your IDE to generate the final APK.

---

## 📜 License
This project is licensed under the **Apache-2.0 License**. See the [LICENSE](LICENSE) file for details.