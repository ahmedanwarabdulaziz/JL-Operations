# Anwar Management System

A comprehensive business management application built with React and Firebase for handling customers, orders, treatments, and workshop operations.

## Features

- **Customer Management**: Add, edit, and manage customer information
- **Order Management**: Create and track orders with detailed furniture specifications
- **Treatment Management**: Manage treatment records and schedules
- **Workshop Operations**: Track workshop activities and materials
- **Material Companies**: Manage supplier and material company data
- **Data Management**: Export data to Excel and manage system data
- **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

- **Frontend**: React 18 with Material-UI (MUI)
- **Backend**: Firebase (Firestore, Authentication)
- **Styling**: Material-UI components with custom theming
- **Data Export**: XLSX for Excel file generation
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Firebase account

### Installation

1. Clone the repository:
```bash
git clone https://github.com/ahmedanwarabdulaziz/anwar-management-system.git
cd anwar-management-system
```

2. Install dependencies:
```bash
npm install
```

3. Set up Firebase:
   - Create a Firebase project
   - Enable Firestore database
   - Add your Firebase configuration to `src/firebase/config.js`

4. Start the development server:
```bash
npm start
```

The application will open at `http://localhost:3000`

## Project Structure

```
src/
├── components/          # Reusable UI components
├── pages/              # Main application pages
│   ├── CustomerManagement/
│   ├── OrderManagement/
│   ├── TreatmentManagement/
│   ├── Workshop/
│   └── DataManagement/
├── firebase/           # Firebase configuration
├── utils/              # Utility functions
└── App.js             # Main application component
```

## Available Scripts

- `npm start` - Runs the app in development mode
- `npm build` - Builds the app for production
- `npm test` - Launches the test runner
- `npm run eject` - Ejects from Create React App

## Firebase Setup

This application uses Firebase for backend services. You'll need to:

1. Create a Firebase project at [https://console.firebase.google.com/](https://console.firebase.google.com/)
2. Enable Firestore Database
3. Set up authentication (if needed)
4. Add your Firebase configuration to the project

## Deployment

The application is deployed on Vercel. Any changes pushed to the main branch will automatically trigger a new deployment.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Commit and push to your branch
5. Create a Pull Request

## License

This project is private and proprietary.

## Contact

For questions or support, please contact the development team. 