import argparse
import json
import os
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error


def safe_mape(y_true, y_pred):
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    mask = np.abs(y_true) > 0
    if not np.any(mask):
        return 0.0
    return np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100


def trend_features(df):
    df = df.copy()
    df['order_date'] = pd.to_datetime(df['order_date'])
    df['day'] = df['order_date'].dt.day
    df['month'] = df['order_date'].dt.month
    df['quarter'] = df['order_date'].dt.quarter
    df['year'] = df['order_date'].dt.year
    df['unit_price'] = np.where(df['quantity_sold'] > 0, df['sales_revenue'] / df['quantity_sold'], 0)
    df['discount_flag'] = (df['discount'] > 0).astype(int)
    df['promo_flag'] = (df['promotion_details'].fillna('').str.len() > 0).astype(int)
    df['rolling_average'] = df['sales_revenue'].rolling(window=3, min_periods=1).mean()
    df['previous_period_sales'] = df['sales_revenue'].shift(1).fillna(0)
    return df


def build_monthly_frame(df):
    monthly = df.groupby(['year', 'month'], as_index=False).agg(
        revenue=('sales_revenue', 'sum'),
        quantity=('quantity_sold', 'sum'),
        avg_discount=('discount', 'mean'),
        avg_price=('unit_price', 'mean')
    )
    monthly['month_index'] = np.arange(len(monthly))
    monthly['lag_1'] = monthly['revenue'].shift(1).fillna(monthly['revenue'].mean())
    monthly['rolling_avg'] = monthly['revenue'].rolling(3, min_periods=1).mean().shift(1).fillna(monthly['revenue'].mean())
    return monthly


def train_and_evaluate_model(model_name, X_train, X_test, y_train, y_test):
    if model_name == 'Linear Regression':
        model = LinearRegression()
    elif model_name == 'Random Forest':
        model = RandomForestRegressor(n_estimators=200, random_state=42)
    else:
        model = LinearRegression()

    model.fit(X_train, y_train)
    predictions = model.predict(X_test)

    mae = mean_absolute_error(y_test, predictions)
    rmse = np.sqrt(mean_squared_error(y_test, predictions))
    mape = safe_mape(y_test, predictions)

    return {
        'MAE': round(float(mae), 2),
        'RMSE': round(float(rmse), 2),
        'MAPE': round(float(mape), 2),
        'predictions': predictions.tolist(),
        'actual': y_test.tolist()
    }


def create_model(model_name):
    if model_name == 'Random Forest':
        return RandomForestRegressor(n_estimators=200, random_state=42)
    return LinearRegression()


def generate_forecast(df, horizon=3):
    monthly = build_monthly_frame(df)
    if len(monthly) < 3:
        raise ValueError('At least three months of sales data are required for model evaluation.')

    feature_columns = ['month_index', 'quantity', 'avg_discount', 'avg_price', 'lag_1', 'rolling_avg']

    split_index = max(1, min(len(monthly) - 1, int(len(monthly) * 0.8)))
    X = monthly[feature_columns]
    y = monthly['revenue']

    X_train = X.iloc[:split_index]
    X_test = X.iloc[split_index:]
    y_train = y.iloc[:split_index]
    y_test = y.iloc[split_index:]

    results = {}
    for name in ['Linear Regression', 'Random Forest', 'Time-Series Model']:
        if name == 'Time-Series Model':
            ts_X_train = X_train[['lag_1', 'rolling_avg']]
            ts_X_test = X_test[['lag_1', 'rolling_avg']]
            ts_model = LinearRegression()
            ts_model.fit(ts_X_train, y_train)
            predictions = ts_model.predict(ts_X_test)
            mae = mean_absolute_error(y_test, predictions)
            rmse = np.sqrt(mean_squared_error(y_test, predictions))
            mape = safe_mape(y_test, predictions)
            results[name] = {
                'MAE': round(float(mae), 2),
                'RMSE': round(float(rmse), 2),
                'MAPE': round(float(mape), 2),
                'predictions': predictions.tolist(),
                'actual': y_test.tolist()
            }
        else:
            results[name] = train_and_evaluate_model(name, X_train, X_test, y_train, y_test)

    best_model_name = min(results, key=lambda name: results[name]['MAE'])
    selected_columns = ['lag_1', 'rolling_avg'] if best_model_name == 'Time-Series Model' else feature_columns
    forecast_model = create_model(best_model_name)
    forecast_model.fit(monthly[selected_columns], y)

    historical = [
        {
            'month': f"{int(row['year'])}-{int(row['month']):02d}",
            'actual': round(float(row['revenue']), 2),
            'predicted': round(float(pred), 2)
        }
        for row, pred in zip(monthly.iloc[split_index:].to_dict('records'), results[best_model_name]['predictions'])
    ]

    future_values = monthly['revenue'].astype(float).tolist()
    last_row = monthly.iloc[-1]
    last_month = pd.Timestamp(year=int(last_row['year']), month=int(last_row['month']), day=1)
    forecast = []
    for step, month_start in enumerate(pd.date_range(last_month + pd.offsets.MonthBegin(1), periods=horizon, freq='MS'), start=1):
        features = {
            'month_index': len(monthly) + step - 1,
            'quantity': float(last_row['quantity']),
            'avg_discount': float(last_row['avg_discount']),
            'avg_price': float(last_row['avg_price']),
            'lag_1': future_values[-1],
            'rolling_avg': float(np.mean(future_values[-3:]))
        }
        prediction = max(0.0, float(forecast_model.predict(pd.DataFrame([features])[selected_columns])[0]))
        future_values.append(prediction)
        forecast.append({
            'month': month_start.strftime('%Y-%m'),
            'predicted': round(prediction, 2)
        })

    predicted_revenue = sum(item['predicted'] for item in forecast)
    error_margin = float(results[best_model_name]['MAE']) * np.sqrt(horizon)
    output = {
        'models': results,
        'bestModel': best_model_name,
        'predictedRevenue': round(predicted_revenue, 2),
        'predictionRange': {
            'low': round(max(0.0, predicted_revenue - error_margin), 2),
            'high': round(predicted_revenue + error_margin, 2)
        },
        'forecastHorizon': horizon,
        'forecast': forecast,
        'actualVsPredicted': historical,
        'history': historical + [{'month': item['month'], 'actual': None, 'predicted': item['predicted']} for item in forecast],
        'note': 'Forecasts use the bundled sample sales dataset. Future quantity, price, and discount inputs are held at their latest observed monthly values.'
    }
    return output


def parse_args():
    parser = argparse.ArgumentParser(description='Train revenue forecasting models from the bundled sales dataset.')
    parser.add_argument('--input', type=str, default='ml/data/sales_data.csv', help='Path to the sales dataset CSV file.')
    parser.add_argument('--horizon', type=int, default=3, choices=range(1, 13), help='Number of future months to forecast (1-12).')
    return parser.parse_args()


def main():
    args = parse_args()
    file_path = Path(args.input)
    if not file_path.exists():
        raise FileNotFoundError(f'Input dataset not found: {file_path}')

    df = pd.read_csv(file_path)
    if 'order_date' not in df.columns:
        raise ValueError('The input dataset must contain an order_date column.')

    prepared = trend_features(df)
    result = generate_forecast(prepared, horizon=args.horizon)
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
