Banking Campaign Response Prediction

Live API: https://bankcampaign.onrender.com
API Docs: https://bankcampaign.onrender.com/docs

To test /predict in Postman, send a POST request to https://bankcampaign.onrender.com/predict with raw JSON body:
Sample test:

{
  "age": 35,
  "job": "technician",
  "marital": "married",
  "education": "university.degree",
  "default": "no",
  "housing": "yes",
  "loan": "no",
  "contact": "cellular",
  "month": "may",
  "day_of_week": "mon",
  "campaign": 2,
  "pdays": 999,
  "previous": 0,
  "poutcome": "nonexistent",
  "emp.var.rate": 1.1,
  "cons.price.idx": 93.994,
  "cons.conf.idx": -36.4,
  "euribor3m": 4.857,
  "nr_employed": 5191.0
}
