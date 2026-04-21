<div align="center">
<img width="200" alt="Idarah Logo" src="./images/logo.png" />
</div>

# Idarah - Educational Management System

Idarah is a comprehensive educational management system designed for schools and educational institutions. It provides an all-in-one platform for managing student information, attendance, fees, exams, courses, and notifications.

## 📋 Project Overview

Idarah (إدارة - meaning "Management") is a modern web-based application built with React and TypeScript that streamlines administrative and educational tasks. It offers a user-friendly interface for managing various aspects of educational institutions.

### ✨ Key Features

- **👥 User Management** - Manage administrators, teachers, and students
- **📚 Course Management** - Create and manage courses and class schedules
- **📍 Attendance Tracking** - Real-time attendance monitoring and reports
- **💰 Fee Management** - Track student fees, payments, and generate receipts
- **📝 Exam Management** - Manage exams and display results
- **📄 Notes & Resources** - Upload and manage course notes
- **🔔 Notifications** - Real-time notifications and announcements
- **📊 Reports & Analytics** - Dashboard with revenue charts and statistics
- **⏰ Schedule Management** - Class and exam scheduling
- **🌙 Dark/Light Theme** - Customizable user interface
- **🔐 Role-based Access Control** - Permission-based features

## 🛠️ Tech Stack

- **Frontend:** React 18 with TypeScript
- **UI Library:** Material-UI (MUI)
- **Styling:** Tailwind CSS, Emotion
- **Build Tool:** Vite
- **Backend:** Firebase & Firestore
- **Authentication:** Firebase Auth
- **Real-time Updates:** Firestore listeners
- **PDF Generation:** React-PDF
- **State Management:** Context API
- **Animations:** Framer Motion

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Firebase project setup

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/zeeshanmaqbool200/Idarah-wali-ul-aser-chattergam.git
   cd Idarah-wali-ul-aser-chattergam
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Firebase:**
   - Update your Firebase credentials in `src/firebase.ts`
   - Ensure Firestore rules are configured in `firestore.rules`

4. **Run the application:**
   ```bash
   npm run dev
   ```

5. **Build for production:**
   ```bash
   npm run build
   ```

## 📁 Project Structure

```
src/
├── components/       # Reusable UI components
├── pages/           # Page components for different features
├── services/        # Firebase and API services
├── context/         # React Context for state management
├── lib/             # Utilities and helper functions
├── types.ts         # TypeScript type definitions
└── App.tsx          # Main application component
```

### Key Components

- **Dashboard** - Overview of key metrics and statistics
- **Attendance** - Attendance tracking and management
- **Fees** - Payment and fee management
- **Courses** - Course listing and management
- **Exams** - Exam scheduling and results
- **Users** - User management panel
- **Reports** - Analytics and reporting

## 🔐 Authentication

The application uses Firebase Authentication with role-based access control:
- **Admin** - Full system access
- **Teacher** - Class and grade management
- **Student** - View grades, attendance, and notes
- **Guardian** - View student progress

## 📱 Features Details

### Attendance System
Track daily attendance with automatic syncing and offline support.

### Fee Management
- Fee collection tracking
- Receipt generation (PDF)
- Payment history
- Revenue analytics

### Notification System
- Real-time in-app notifications
- Email notifications via Firebase
- Announcement broadcasting

### Reporting
- Comprehensive analytics dashboard
- Revenue and attendance reports
- Exportable reports

## 🔄 Data Sync

The application includes automatic data synchronization with offline support via:
- Firestore real-time listeners
- Local sync queue
- Error handling and retry mechanisms

## 📋 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Check TypeScript
- `npm run clean` - Remove build artifacts

## 🤝 Contributing

Contributions are welcome! Please follow the existing code style and ensure all features are tested.

## 📝 License

This project is licensed under the Apache 2.0 License - see the [LICENSE](LICENSE) file for details.

## 📧 Support

For issues, questions, or feature requests, please open an issue on GitHub or contact the development team.

---

**Made with ❤️ for educational institutions**
