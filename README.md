# REVORA Intelligence

AI-powered sales analytics and revenue forecasting: Predict Growth. Power Success.

## Project structure

- frontend/ — React + Vite dashboard
- backend/ — Express REST API and dataset endpoints
- ml/ — Python forecasting service and sample sales data
- database/ — MySQL schema and demo inserts
- .env.example — environment variable template

## Included features

- Professional login screen and dashboard shell
- Public registration and login: anyone can create an account and is signed in immediately; new accounts are users by default, and the configured administrator email receives admin access
- HttpOnly session cookies, working profile and password settings, and saved appearance/notification preferences
- Administrator-only user-role management and sales-data imports/edits
- Database-backed date, product, category, region, and search filters
- Filter-aware CSV and print/PDF reports
- KPI cards for revenue, profit, orders, quantity sold, average order value, and predicted revenue
- Sales, product, category, customer, seasonal, and profit analysis views
- Category catalog with selectable top-level categories, subcategories, and example items
- Category-first navigation and a product browser with category/subcategory listings and matching sales metrics
- In-app REVORA Help chat for feature guidance and common questions
- Revenue prediction workflows with model comparison and evaluation metrics
- CSV upload and dataset management screen
- EDA summary and sample data handling
- REST APIs with JSON responses and demo-data labeling when production data is not connected

## Deploy the frontend to GitHub Pages

The `main` branch is configured to build and deploy `frontend/` to GitHub Pages. In the repository's **Settings → Pages**, set the build and deployment source to **GitHub Actions**. Push to `main` (or manually run the **Deploy frontend to GitHub Pages** workflow) to publish the site at `https://adithya3014-dev.github.io/Sales-Revenue/`.

GitHub Pages hosts only the static frontend; it cannot run the Express API, MySQL database, or Python forecasting service. To use registration, login, sales data, or forecasting on the published site, deploy the backend and its dependencies separately, then set the Actions repository variable `VITE_API_URL` to the backend API URL (for example, `https://your-backend.example.com/api`). Set the backend's `ALLOWED_ORIGINS` to the exact Pages origin (for example, `https://adithya3014-dev.github.io`) so credentialed API requests and session cookies are accepted. Production session cookies require HTTPS.

## Run locally with MySQL

Requirements: Node.js (LTS), MySQL Server, MySQL Workbench, and Python if you plan to use revenue prediction.

1. Start MySQL Server from MySQL Workbench or the Windows Services app. In Workbench, confirm you can connect to your local MySQL instance.
2. Open this project folder in VS Code. In a terminal at the project root, create your environment file:

   ```powershell
   Copy-Item .env.example .env
   ```

3. Open `.env` in VS Code and set the MySQL account details:

   ```dotenv
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=sales_revenue_dashboard
   ```

   For local MySQL, use your actual username, password, and port. The account must be allowed to create databases and tables. Keep `.env` private; it is ignored by Git.
4. In a VS Code terminal, install and start the backend:

   ```powershell
   cd backend
   npm install
   npm run dev
   ```

   On first startup, the backend creates the database named by `DB_NAME` for local MySQL and applies `database/schema.sql`. For remote MySQL, create the database in your provider first. By default, the backend does not insert sample sales; import your own CSV from Data Management. To load the bundled sample sales for a clearly labeled demo, set `SEED_SAMPLE_SALES=true` in `.env` before starting the backend.
5. Open a second VS Code terminal and start the frontend:

   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

6. Open the Vite URL printed in the frontend terminal. To inspect the database in Workbench, connect to the same local MySQL instance and refresh the Schemas panel; the configured database and its tables appear after the backend starts.

For secure password recovery, configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `EMAIL_FROM` in `.env`. Password reset links are not exposed in backend logs or development responses; recovery remains unavailable until email delivery is configured.

Set `ADMIN_EMAIL` to the exact email address that should receive administrator access when registering a new account. Existing accounts are not automatically promoted or demoted when this setting changes. To grant an existing account initial administrator access, run a targeted update in MySQL Workbench, replacing the example address with the intended account:

```sql
UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';
```

After that, sign in again to refresh the account's available admin controls. Other registrations receive the `user` role. Sales imports must include the required fields in the downloadable CSV template; each import is validated and inserted transactionally, and duplicate order IDs are rejected without overwriting existing records.

For prediction requests, create and install the project Python environment from the project root before starting the backend:

```powershell
python -m venv backend\.venv
backend\.venv\Scripts\python.exe -m pip install -r ml\requirements.txt
```

The backend automatically uses this environment for forecasts. Forecasts and model metrics use the bundled ML dataset; sales, dashboard, analytics, and CSV imports use MySQL.

## Use Aiven MySQL

1. In the Aiven Console, create a MySQL service and a database for the app. Download that service's CA certificate and save it locally as `backend\ca.pem` (this file is ignored by Git).
2. Set the Aiven connection details in the project-root `.env` file:

   ```dotenv
   DB_HOST=your-service-host.aivencloud.com
   DB_PORT=your-service-port
   DB_USER=avnadmin
   DB_PASSWORD=your-aiven-password
   DB_NAME=your-created-database
   DB_SSL_CA=backend\ca.pem
   ```

   Use the host, port, user, password, and database shown in the Aiven Console. The backend verifies the TLS connection using the CA certificate and applies `database/schema.sql` to the selected database. Do not commit credentials or the downloaded certificate.
3. To connect with MySQL Workbench, create a connection using the same Aiven host, port, and user. In the connection's **SSL** tab, choose **Verify CA** and select the downloaded CA certificate, then test and save the connection. After the backend starts, refresh Workbench's **Schemas** panel to see the configured database and its tables.
4. Start the backend with `cd backend` and `npm run dev`, then start the frontend as described above.
