
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
import pandas as pd
import joblib
from pathlib import Path

# --------------------------------
# 1. Create FastAPI application
# --------------------------------

app = FastAPI(title="CampaignPilot")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------
# 2. Load trained model
# --------------------------------

BASE_DIR = Path(__file__).resolve().parent

artifact = joblib.load(
    BASE_DIR / "bankreach_random_forest_model.joblib"
)

model = artifact["model"]
feature_columns = artifact["feature_columns"]


# --------------------------------
# 3. Customer input structure
# --------------------------------

class Customer(BaseModel):

    age: int
    job: str
    marital: str
    education: str
    default: str
    housing: str
    loan: str
    contact: str
    month: str
    day_of_week: str
    campaign: int
    pdays: int
    previous: int
    poutcome: str

    emp_var_rate: float = Field(alias="emp.var.rate")
    cons_price_idx: float = Field(alias="cons.price.idx")
    cons_conf_idx: float = Field(alias="cons.conf.idx")
    euribor3m: float
    nr_employed: float


# --------------------------------
# 4. Multiple customer input
# --------------------------------

class CustomerBatch(BaseModel):
    customers: list[Customer]
class CampaignRequest(BaseModel):
    customers: list[Customer]
    max_calls: int = Field(gt=0)
class StrategyComparisonRequest(BaseModel):
    customers: list[Customer]
    max_calls: int = Field(gt=0)

# --------------------------------
# 5. Home endpoint & Frontend
# --------------------------------

@app.get("/")
def home():

    return {
        "message": "Welcome to CampaignPilot"
    }

@app.get("/app")
def serve_frontend():
    return FileResponse(BASE_DIR / "index.html")

@app.get("/style.css")
def serve_css():
    return FileResponse(BASE_DIR / "style.css", media_type="text/css")

@app.get("/script.js")
def serve_js():
    return FileResponse(BASE_DIR / "script.js", media_type="application/javascript")


# --------------------------------
# 6. Individual customer prediction
# --------------------------------

@app.post("/predict")
def predict_customer(customer: Customer):

    # Convert customer details into a DataFrame
    customer_data = customer.model_dump(by_alias=True)

    input_df = pd.DataFrame([customer_data])

    # One-hot encoding
    input_encoded = pd.get_dummies(input_df)

    # Match training feature columns
    input_encoded = input_encoded.reindex(
        columns=feature_columns,
        fill_value=0
    )

    # Predict Yes or No
    prediction = int(model.predict(input_encoded)[0])

    # Get prediction probabilities
    probabilities = model.predict_proba(input_encoded)[0]

    # Find probability for Yes (class 1)
    yes_index = list(model.classes_).index(1)

    probability = float(
        probabilities[yes_index] * 100
    )

    return {
        "prediction": "Yes" if prediction == 1 else "No",
        "subscription_probability": round(probability, 2)
    }


# --------------------------------
# 7. Multiple customer prioritization
# --------------------------------

@app.post("/prioritize")
def prioritize_customers(batch: CustomerBatch):

    # Convert customer data into a DataFrame
    customer_records = [
        customer.model_dump(by_alias=True)
        for customer in batch.customers
    ]

    input_df = pd.DataFrame(customer_records)

    # Encode categorical columns
    input_encoded = pd.get_dummies(input_df)

    # Match the model's training columns
    input_encoded = input_encoded.reindex(
        columns=feature_columns,
        fill_value=0
    )

    # Calculate subscription probabilities
    probabilities = model.predict_proba(input_encoded)

    # Find probability for Yes
    yes_index = list(model.classes_).index(1)

    # Store customer results
    results = []

    for i, probability in enumerate(probabilities):

        results.append({
            "customer_number": i + 1,

            "subscription_probability": round(
                float(probability[yes_index] * 100), 2
            )
        })

    # Sort customers from highest probability to lowest
    results.sort(
        key=lambda x: x["subscription_probability"],
        reverse=True
    )

    # Assign priority ranks
    for rank, customer in enumerate(results, start=1):

        customer["priority_rank"] = rank

    return {
        "prioritized_customers": results
    }

# --------------------------------
# Model information endpoint
# --------------------------------

@app.get("/model-info")
def model_info():

    return {
        "project_name": "CampaignPilot",
        "model_name": artifact.get("model_name", "Random Forest"),
        "model_type": type(model).__name__,
        "number_of_features": len(feature_columns),
        "excluded_features": artifact.get(
            "excluded_features", []
        ),
        "target_mapping": artifact.get(
            "target_mapping", {}
        )
    }

# --------------------------------
# Model performance metrics
# --------------------------------

@app.get("/model-metrics")
def model_metrics():

    return {
        "model_name": "Random Forest",

        "accuracy": 86.86,
        "precision": 43.80,
        "recall": 58.62,
        "f1_score": 50.14,

        "metric_unit": "percentage",
        "note": "Test dataset performance"
    }

# --------------------------------
# Campaign Simulator
# --------------------------------

@app.post("/campaign-simulator")
def campaign_simulator(request: CampaignRequest):

    # Convert customers into DataFrame
    customer_records = [
        customer.model_dump(by_alias=True)
        for customer in request.customers
    ]

    input_df = pd.DataFrame(customer_records)

    # One-hot encoding
    input_encoded = pd.get_dummies(input_df)

    # Match training columns
    input_encoded = input_encoded.reindex(
        columns=feature_columns,
        fill_value=0
    )

    # Calculate probabilities
    probabilities = model.predict_proba(input_encoded)

    yes_index = list(model.classes_).index(1)

    # Store customer probabilities
    results = []

    for i, probability in enumerate(probabilities):

        results.append({
            "customer_number": i + 1,
            "subscription_probability": round(
                float(probability[yes_index] * 100), 2
            )
        })

    # Sort by probability
    results.sort(
        key=lambda x: x["subscription_probability"],
        reverse=True
    )

    # Select customers within calling capacity
    selected_customers = results[:request.max_calls]

    # Calculate expected subscriptions
    expected_subscriptions = sum(
        customer["subscription_probability"] / 100
        for customer in selected_customers
    )

    return {
        "total_customers": len(results),
        "available_call_capacity": request.max_calls,
        "customers_selected": len(selected_customers),
        "expected_subscriptions": round(
            expected_subscriptions, 2
        ),
        "selected_customers": selected_customers
    }

# --------------------------------
# Compare AI vs Random Strategy
# --------------------------------

@app.post("/compare-strategies")
def compare_strategies(request: StrategyComparisonRequest):

    # Check calling capacity
    total_customers = len(request.customers)

    if total_customers == 0:
        return {"error": "Please provide at least one customer"}

    if request.max_calls > total_customers:
        return {
            "error": "Call capacity cannot exceed total customers"
        }

    # Convert customer data into DataFrame
    customer_records = [
        customer.model_dump(by_alias=True)
        for customer in request.customers
    ]

    input_df = pd.DataFrame(customer_records)

    # One-hot encoding
    input_encoded = pd.get_dummies(input_df)

    # Match training columns
    input_encoded = input_encoded.reindex(
        columns=feature_columns,
        fill_value=0
    )

    # Calculate subscription probabilities
    probabilities = model.predict_proba(input_encoded)

    yes_index = list(model.classes_).index(1)

    # Store customer probabilities
    results = []

    for i, probability in enumerate(probabilities):

        results.append({
            "customer_number": i + 1,
            "subscription_probability": float(
                probability[yes_index] * 100
            )
        })

    # AI strategy: select highest probabilities
    ai_selected = sorted(
        results,
        key=lambda x: x["subscription_probability"],
        reverse=True
    )[:request.max_calls]

    # Random strategy: select random customers
    random_selected = (
        pd.DataFrame(results)
        .sample(n=request.max_calls, random_state=42)
        .to_dict(orient="records")
    )

    # Calculate estimated subscriptions
    ai_expected = sum(
        x["subscription_probability"] / 100
        for x in ai_selected
    )

    random_expected = sum(
        x["subscription_probability"] / 100
        for x in random_selected
    )

    return {
        "total_customers": total_customers,
        "calling_capacity": request.max_calls,

        "AI_strategy": {
            "customers_selected": len(ai_selected),
            "expected_subscriptions": round(ai_expected, 2),
            "selected_customers": ai_selected
        },

        "Random_strategy": {
            "customers_selected": len(random_selected),
            "expected_subscriptions": round(random_expected, 2),
            "selected_customers": random_selected
        },

        "estimated_difference": round(
            ai_expected - random_expected, 2
        )
    }
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

