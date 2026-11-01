# AI Driver Drowsiness Detection System

A premium, interactive driver safety monitor system built with **Spring Boot** and a gorgeous modern **Glassmorphic Web UI**. It uses computer vision simulations and real camera mappings to capture eye and mouth metrics, sound alarms during micro-sleeps, and log geolocated incidents.

## 🚀 Key Features
- **User Authentication**: Login/Register drivers and vehicle metrics.
- **AI Facial Mesh Canvas**: Visualizes eyes and mouth landmarks dynamically.
- **Decision Engine (EAR/Yawn)**: Tracks Eye Aspect Ratio and Mouth Yawning Score to sound alarms.
- **Audio Buzzer System**: Built-in sound alarm utilizing HTML5 Web Audio API (zero dependency issues).
- **Incident Logger**: Logs coordinate values, date, type, and resolved town address (e.g. Salem, Chennai).
- **Interactive Leaflet Map**: Click to see exact GPS alert locations.
- **Dynamic Charts**: Chart.js charts mapping drowsiness incidents hourly.
- **Presenter Demo Panel**: Keyboard hotkeys to instantly show eye closure/yawning states to external examiners without fail.

---

## 🛠️ Requirements & Setup

### Prerequisites
1. **Java Development Kit (JDK) 25** or above.
2. **Apache Maven** installed.
3. Modern browser (Chrome, Edge, Firefox) with Web Audio and Webcam permissions.

---

## 🏃 How to Run the Project

### Option A: Running from Terminal/CLI

1. Open a terminal inside the project directory:
   ```bash
   cd driver-drowsiness-detector
   ```
2. Run the application using the Spring Boot Maven wrapper/plugin:
   ```bash
   mvn spring-boot:run
   ```
3. Once compilation finishes and you see `Started DrowsinessDetectionApplication`, open your browser to:
   **[http://localhost:8080](http://localhost:8080)**

---

### Option B: Running in IDE (IntelliJ IDEA / Eclipse / VS Code)

1. **IntelliJ IDEA**:
   - Select **File -> Open** and choose the `driver-drowsiness-detector` folder.
   - Wait for Maven to download dependencies.
   - Right-click `DrowsinessDetectionApplication.java` inside `src/main/java/com/drowsiness/detection/` and select **Run**.

2. **VS Code**:
   - Open folder `driver-drowsiness-detector`.
   - Install **Extension Pack for Java** and **Spring Boot Extension Pack** if prompted.
   - Press **F5** or click the run button above the `main` method in `DrowsinessDetectionApplication.java`.

---

## 💡 Quick Demo Configuration (Failsafe)

- **Default User Credentials**:
  - **Username**: `driver`
  - **Password**: `password123`
  *(These credentials are seed-loaded automatically on startup)*

- **Presentation Mode Simulator Shortcuts**:
  When on the **Webcam Monitor** screen, press the following keyboard keys to simulate alerts in front of examiners:
  - **`C`**: Simulates **Eyes Closed** state. Triggers the warning, sounds the alarm, and logs the incident to the database.
  - **`Y`**: Simulates **Yawning** state. Triggers warning, sounds alarm, and logs incident.
  - **`A`**: Resets state to **Alert/Normal** (Silences buzzer and restores green indicator).

---

## 🗄️ Database Configurations

By default, the application runs on an **H2 In-Memory Database** (zero setup required). If you want to switch to **MySQL**:

1. Open `src/main/resources/application.properties`.
2. Comment out Option 1 (H2 settings).
3. Uncomment Option 2 (MySQL settings) and fill in your password:
   ```properties
   spring.datasource.url=jdbc:mysql://localhost:3306/drowsiness_db?createDatabaseIfNotExist=true
   spring.datasource.username=root
   spring.datasource.password=your_mysql_password
   ```
4. Restart the Spring Boot app. It will automatically create the tables inside MySQL.
5. To view the H2 web console (when running in H2 mode), navigate to **[http://localhost:8080/h2-console](http://localhost:8080/h2-console)** (JDBC URL: `jdbc:h2:mem:drowsiness_db`, User: `sa`, no password).
