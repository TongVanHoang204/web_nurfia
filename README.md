# Nurfia Fashion eCommerce

A professional, full-stack eCommerce platform clone built with modern web technologies, featuring a responsive design and comprehensive management system.

## Features

### Frontend (User Experience)
- **Responsive Design**: Mobile-first approach for seamless shopping across all devices.
- **Dynamic Product Gallery**: Shopee-style product image viewing with thumbnail navigation.
- **Shopping System**: Fully functional Shopping Cart, Wishlist, and Product Comparison.
- **Blog Module**: Detailed blog posts with sidebar widgets and category filtering.
- **Real-time Notifications**: Instant feedback via Socket.io for activities and updates.
- **Clean UI**: Built with vanilla CSS for high performance and custom premium aesthetics.

### Backend (Management & Security)
- **Robust API**: RESTful endpoints built with Express.js and TypeScript.
- **Data Integrity**: Prisma ORM for type-safe database operations.
- **Security Suite**:
  - JWT Authentication for users and admins.
  - Rate limiting and XSS protection.
  - Image optimization and secure uploads via Sharp & Multer.
- **Admin Dashboard**: Comprehensive management of orders, products, categories, and site settings.
- **Activity Logging**: Detailed tracking of system and user activities.

## 🛠 Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React, TypeScript, Vite, CSS (Vanilla), Context API, Socket.io Client |
| **Backend** | Node.js, Express, TypeScript, Prisma ORM, Socket.io Server |
| **Database** | SQLite / PostgreSQL (Prisma compatible) |
| **Testing/Tools** | Jest, Concurrent, ESLint, Prettier |

## 📁 Project Structure

```text
.
├── backend/            # Express.js API & Database (Prisma)
├── frontend/           # React Client Application
├── package.json        # Root workspace configuration
└── README.md           # Project documentation
```

## ⚙️ Installation & Setup

### Prerequisites
- Node.js (v18.x or higher)
- npm or yarn

### Setup Steps

1. **Install Dependencies** (from root):
   ```bash
   npm install
   ```

2. **Backend Configuration**:
   - Navigate to `backend/`
   - Create a `.env` file based on `.env.example`
   - Set up the database:
     ```bash
     npx prisma generate
     npx prisma migrate dev
     ```

3. **Frontend Configuration**:
   - Navigate to `frontend/`
   - Create a `.env` file for API endpoints (if required)

## Running the Application

You can run both the frontend and backend concurrently from the root directory:

```bash
# Run developers mode (Concurrent)
npm run dev

# Backend only
npm run dev:backend

# Frontend only
npm run dev:frontend
```

## 📄 License
This project is for educational purposes. All rights to the original Nurfia design belong to the respective owners.
