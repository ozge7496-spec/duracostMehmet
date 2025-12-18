from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import math
import certifi
import ssl

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection configuration
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'test_database')

# Check if it's an Atlas connection (mongodb+srv) or local
if 'mongodb+srv' in mongo_url or 'mongodb.net' in mongo_url:
    # Atlas connection with SSL
    client = AsyncIOMotorClient(
        mongo_url,
        tlsCAFile=certifi.where(),
        serverSelectionTimeoutMS=5000,
        connectTimeoutMS=10000
    )
else:
    # Local MongoDB connection
    client = AsyncIOMotorClient(mongo_url)

db = client[db_name]

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
logger.info(f"MongoDB configured: {db_name}")

app = FastAPI()
api_router = APIRouter(prefix="/api")
uk_router = APIRouter(prefix="/api/uk")

COUNTRY_MIN_WAGES = {
    "United Kingdom": 12.21,
    "Ireland": 13.50,
    "France": 11.88,
    "Germany": 12.82,
    "Netherlands": 13.68,
    "Belgium": 12.01,
    "Spain": 8.51,
    "Italy": 9.80,
    "Portugal": 5.23,
    "Poland": 4.95,
    "Czech Republic": 4.95,
    "Austria": 12.85,
    "Switzerland": 25.00,
    "Sweden": 0.00,
    "Norway": 0.00,
    "Denmark": 0.00,
    "United Arab Emirates": 2.72,
    "Saudi Arabia": 2.67,
    "Qatar": 2.00,
    "Kuwait": 2.72,
    "Oman": 1.68,
    "Bahrain": 2.13,
    "Turkey": 3.29,
    "Egypt": 1.36,
    "Jordan": 2.27,
    "Lebanon": 1.00,
    "United States": 7.25,
    "Canada": 11.00,
    "Australia": 23.23,
    "New Zealand": 22.70,
}

class CalculationRequest(BaseModel):
    user_name: str
    project_name: str
    country: str
    fence_type: str
    meters: float
    gates: int
    ground_fixing_method: str = "Angle Steel"
    custom_daily_rate: Optional[int] = None
    manual_daily_labor_rate: Optional[float] = None  # Optional manual daily labor rate per person

class CostBreakdown(BaseModel):
    work_days: float
    daily_rate_per_man: Optional[float] = 0.0
    labor_cost: float
    tools_cost: float
    supervision_cost: float
    flight_ticket: float
    ground_fixing_cost: Optional[float] = 0.0
    raw_total: float
    rate_per_meter: float
    markup_30: float
    markup_40: float
    markup_50: float
    markup_60: float
    bad_case_20: float
    more_bad_case_40: float
    worst_case_80: float

class Calculation(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_name: str
    project_name: str
    country: str
    fence_type: str
    meters: float
    gates: int
    ground_fixing_method: Optional[str] = "Angle Steel"
    breakdown: CostBreakdown
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CalculationResponse(BaseModel):
    calculation: Calculation

@api_router.get("/")
async def root():
    return {"message": "Racing Fence Installation Pricing API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@api_router.get("/countries")
async def get_countries():
    return {"countries": sorted(list(COUNTRY_MIN_WAGES.keys()))}

def calculate_pricing(request: CalculationRequest):
    """Helper function to calculate pricing without saving to database"""
    if request.country not in COUNTRY_MIN_WAGES:
        raise HTTPException(status_code=400, detail="Invalid country selected")

    min_wage = COUNTRY_MIN_WAGES[request.country]

    if min_wage == 0:
        min_wage = 15.00

    # Fence types synchronized with UK version, scaled for 8-man team
    # OR = 1080m/day (8 men), others = 240m/day (8 men)
    fence_types = {
        "OR": 1080,   # Oval Running Rail - 1080m/day for 8-man team
        "PR": 240,    # PR - 240m/day for 8-man team
        "CM": 240,    # CM - 240m/day for 8-man team
        "CT": 240,    # CT - 240m/day for 8-man team
        "HM": 240     # HM - 240m/day for 8-man team
    }

    # Use custom daily rate if provided, otherwise use predefined fence types
    if request.custom_daily_rate and request.custom_daily_rate > 0:
        daily_capacity = request.custom_daily_rate
    else:
        daily_capacity = fence_types.get(request.fence_type, 240)

    fence_days = request.meters / daily_capacity
    # Gate logic: 1 gate takes 2 hours of 2 agents (4 man-hours)
    # For 8-man team: 4 man-hours / (8 men * 8 hours/day) = 0.0625 days per gate
    gate_days = request.gates * 0.0625
    setup_cleanup_days = 1
    total_work_days_calculated = fence_days + gate_days + setup_cleanup_days

    total_work_days = math.ceil(total_work_days_calculated)

    # Use manual daily labor rate if provided, otherwise calculate from minimum wage
    if request.manual_daily_labor_rate and request.manual_daily_labor_rate > 0:
        daily_rate_per_man = request.manual_daily_labor_rate
    else:
        hourly_labor_rate = 2 * min_wage
        daily_rate_per_man = hourly_labor_rate * 8
    
    daily_labor_cost = 8 * daily_rate_per_man  # 8-man team
    total_labor_cost = daily_labor_cost * total_work_days

    tools_base = 200
    tools_daily = 100 * total_work_days
    total_tools_cost = tools_base + tools_daily

    supervision_daily = 250 * total_work_days
    flight_ticket = 500
    total_supervision_cost = supervision_daily

    if request.ground_fixing_method == "Inner GMS Post with Baseplate":
        ground_fixing_cost = request.meters * 0.078
    else:
        # Default is Angle Steel
        ground_fixing_cost = request.meters * 1.0

    raw_total = total_labor_cost + total_tools_cost + total_supervision_cost + flight_ticket + ground_fixing_cost
    rate_per_meter = raw_total / request.meters

    breakdown = CostBreakdown(
        work_days=float(total_work_days),
        daily_rate_per_man=round(daily_rate_per_man, 2),
        labor_cost=round(total_labor_cost, 2),
        tools_cost=round(total_tools_cost, 2),
        supervision_cost=round(total_supervision_cost, 2),
        flight_ticket=flight_ticket,
        ground_fixing_cost=round(ground_fixing_cost, 2),
        raw_total=round(raw_total, 2),
        rate_per_meter=round(rate_per_meter, 2),
        markup_30=round(raw_total * 1.30, 2),
        markup_40=round(raw_total * 1.40, 2),
        markup_50=round(raw_total * 1.50, 2),
        markup_60=round(raw_total * 1.60, 2),
        bad_case_20=round(raw_total * 1.20, 2),
        more_bad_case_40=round(raw_total * 1.40, 2),
        worst_case_80=round(raw_total * 1.80, 2)
    )

    calculation = Calculation(
        user_name=request.user_name,
        project_name=request.project_name,
        country=request.country,
        fence_type=request.fence_type,
        meters=request.meters,
        gates=request.gates,
        ground_fixing_method=request.ground_fixing_method,
        breakdown=breakdown
    )

    return calculation

@api_router.post("/calculate-preview", response_model=CalculationResponse)
async def calculate_preview(request: CalculationRequest):
    """Calculate pricing without saving to database"""
    calculation = calculate_pricing(request)
    return {"calculation": calculation}

@api_router.post("/archive", response_model=CalculationResponse)
async def archive_calculation(calculation: Calculation):
    """Save calculation to archive"""
    doc = calculation.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()

    await db.calculations.insert_one(doc)

    return {"calculation": calculation}

class DeleteRequest(BaseModel):
    ids: List[str]

@api_router.post("/delete-calculations")
async def delete_calculations(request: DeleteRequest):
    """Delete calculations by IDs"""
    try:
        result = await db.calculations.delete_many({"id": {"$in": request.ids}})
        return {"deleted_count": result.deleted_count, "ids": request.ids}
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error(f"Error deleting calculations: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete calculations")

@api_router.get("/calculations")
async def get_calculations():
    calculations = await db.calculations.find({}, {"_id": 0}).sort("timestamp", -1).to_list(100)

    result = []
    for calc in calculations:
        try:
            if isinstance(calc['timestamp'], str):
                calc['timestamp'] = datetime.fromisoformat(calc['timestamp'])

            # Add default values for new fields if they don't exist (backwards compatibility)
            if 'ground_fixing_method' not in calc:
                calc['ground_fixing_method'] = "Angle Steel"

            if 'breakdown' in calc:
                if 'daily_rate_per_man' not in calc['breakdown']:
                    calc['breakdown']['daily_rate_per_man'] = 0.0

                # Migrate old ground_fixing_screws to ground_fixing_cost
                if 'ground_fixing_screws' in calc['breakdown'] and 'ground_fixing_cost' not in calc['breakdown']:
                    calc['breakdown']['ground_fixing_cost'] = calc['breakdown'].pop('ground_fixing_screws', 0.0)
                elif 'ground_fixing_cost' not in calc['breakdown']:
                    calc['breakdown']['ground_fixing_cost'] = 0.0

            # Validate and convert to Calculation model
            validated_calc = Calculation(**calc)
            result.append(validated_calc.model_dump())
        except Exception as e:
            # Skip invalid calculations
            logger = logging.getLogger(__name__)
            logger.warning(f"Skipping invalid calculation: {e}")
            continue

    return result

class UKCalculationRequest(BaseModel):
    user_name: str
    project_name: str
    fence_type: str
    meters: float
    gates: int
    is_time_sensitive: bool = False
    days_available: Optional[int] = None
    num_labourers: Optional[int] = None
    delivery_lead: Optional[str] = None
    delivery_copilot: Optional[str] = None
    custom_daily_rate: Optional[int] = None
    driving_hours: Optional[float] = None  # One-way driving hours

class UKCostBreakdown(BaseModel):
    work_days: float
    num_labourers: int
    daily_rate_per_man: float
    labor_cost: float
    tools_cost: float
    accommodation_cost: float
    transportation_cost: float
    concrete_cost: float
    raw_total: float
    rate_per_meter: float
    markup_30: float
    markup_40: float
    markup_50: float
    markup_60: float
    bad_case_20: float
    more_bad_case_40: float
    worst_case_80: float

class UKCalculation(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    calculator_type: str = "uk"
    user_name: str
    project_name: str
    fence_type: str
    meters: float
    gates: int
    is_time_sensitive: bool
    days_available: Optional[int] = None
    num_labourers: int
    delivery_lead: Optional[str] = None
    delivery_copilot: Optional[str] = None
    breakdown: UKCostBreakdown
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UKCalculationResponse(BaseModel):
    calculation: UKCalculation

UK_DAILY_RATE_PER_MAN = 200.0
UK_ACCOMMODATION_PER_DAY_PER_MAN = 75.0
UK_TRANSPORTATION_COST = 250.0
UK_CONCRETE_COST_PER_METER = 2.0
UK_FENCE_PRODUCTIVITY = {
    "OR": 270,
    "PR": 60,
    "CM": 60,
    "CT": 60,
    "HM": 60
}

def calculate_uk_pricing(request: UKCalculationRequest):
    """Calculate UK-specific pricing"""
    # Use custom daily rate if provided, otherwise use predefined fence types
    if request.custom_daily_rate and request.custom_daily_rate > 0:
        base_productivity_2_men = request.custom_daily_rate
    elif request.fence_type in UK_FENCE_PRODUCTIVITY:
        base_productivity_2_men = UK_FENCE_PRODUCTIVITY[request.fence_type]
    else:
        # Default to 60m/day for unknown custom fence types
        base_productivity_2_men = 60

    gate_hours_total = request.gates * 2

    fence_days_for_2_men = request.meters / base_productivity_2_men
    gate_days_for_2_men = gate_hours_total / 8
    setup_cleanup_days = 1

    total_worker_days_needed = (fence_days_for_2_men + gate_days_for_2_men + setup_cleanup_days) * 2

    if request.is_time_sensitive and request.days_available:
        days_available = request.days_available
        required_labourers = math.ceil(total_worker_days_needed / days_available)
        if required_labourers < 2:
            required_labourers = 2
        if required_labourers % 2 != 0:
            required_labourers += 1
        num_labourers = required_labourers
        total_work_days = math.ceil(total_worker_days_needed / num_labourers)
    else:
        num_labourers = request.num_labourers if request.num_labourers and request.num_labourers >= 2 else 2
        if num_labourers % 2 != 0:
            num_labourers += 1
        total_work_days = math.ceil(total_worker_days_needed / num_labourers)

    labor_cost = num_labourers * UK_DAILY_RATE_PER_MAN * total_work_days

    tools_base = 200
    tools_daily = 100 * total_work_days
    total_tools_cost = tools_base + tools_daily

    accommodation_cost = num_labourers * UK_ACCOMMODATION_PER_DAY_PER_MAN * total_work_days

    transportation_cost = UK_TRANSPORTATION_COST

    if request.fence_type in ["PR", "CM", "CT", "HM"]:
        concrete_cost = request.meters * UK_CONCRETE_COST_PER_METER
    else:
        concrete_cost = 0.0

    raw_total = labor_cost + total_tools_cost + accommodation_cost + transportation_cost + concrete_cost
    rate_per_meter = raw_total / request.meters if request.meters > 0 else 0

    breakdown = UKCostBreakdown(
        work_days=float(total_work_days),
        num_labourers=num_labourers,
        daily_rate_per_man=UK_DAILY_RATE_PER_MAN,
        labor_cost=round(labor_cost, 2),
        tools_cost=round(total_tools_cost, 2),
        accommodation_cost=round(accommodation_cost, 2),
        transportation_cost=round(transportation_cost, 2),
        concrete_cost=round(concrete_cost, 2),
        raw_total=round(raw_total, 2),
        rate_per_meter=round(rate_per_meter, 2),
        markup_30=round(raw_total * 1.30, 2),
        markup_40=round(raw_total * 1.40, 2),
        markup_50=round(raw_total * 1.50, 2),
        markup_60=round(raw_total * 1.60, 2),
        bad_case_20=round(raw_total * 1.20, 2),
        more_bad_case_40=round(raw_total * 1.40, 2),
        worst_case_80=round(raw_total * 1.80, 2)
    )

    calculation = UKCalculation(
        user_name=request.user_name,
        project_name=request.project_name,
        fence_type=request.fence_type,
        meters=request.meters,
        gates=request.gates,
        delivery_lead=request.delivery_lead if request.delivery_lead else request.user_name,
        delivery_copilot=request.delivery_copilot,
        is_time_sensitive=request.is_time_sensitive,
        days_available=request.days_available,
        num_labourers=num_labourers,
        breakdown=breakdown
    )

    return calculation

@uk_router.get("/")
async def uk_root():
    return {"message": "UK Racing Fence Installation Pricing API"}

@uk_router.get("/fence-types")
async def get_uk_fence_types():
    return {"fence_types": list(UK_FENCE_PRODUCTIVITY.keys())}

@uk_router.post("/calculate-preview", response_model=UKCalculationResponse)
async def uk_calculate_preview(request: UKCalculationRequest):
    """Calculate UK pricing without saving to database"""
    calculation = calculate_uk_pricing(request)
    return {"calculation": calculation}

@uk_router.post("/archive", response_model=UKCalculationResponse)
async def uk_archive_calculation(calculation: UKCalculation):
    """Save UK calculation to archive"""
    doc = calculation.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    doc['calculator_type'] = 'uk'

    await db.uk_calculations.insert_one(doc)

    return {"calculation": calculation}

@uk_router.post("/delete-calculations")
async def uk_delete_calculations(request: DeleteRequest):
    """Delete UK calculations by IDs"""
    try:
        result = await db.uk_calculations.delete_many({"id": {"$in": request.ids}})
        return {"deleted_count": result.deleted_count, "ids": request.ids}
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error(f"Error deleting UK calculations: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete calculations")

@uk_router.get("/calculations")
async def get_uk_calculations():
    calculations = await db.uk_calculations.find({}, {"_id": 0}).sort("timestamp", -1).to_list(100)

    result = []
    for calc in calculations:
        try:
            if isinstance(calc['timestamp'], str):
                calc['timestamp'] = datetime.fromisoformat(calc['timestamp'])

            validated_calc = UKCalculation(**calc)
            result.append(validated_calc.model_dump())
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.warning(f"Skipping invalid UK calculation: {e}")
            continue

    return result

app.include_router(api_router)
app.include_router(uk_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

FRONTEND_BUILD_DIR = ROOT_DIR.parent / "frontend" / "build"

if FRONTEND_BUILD_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_BUILD_DIR / "static")), name="static")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        file_path = FRONTEND_BUILD_DIR / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(FRONTEND_BUILD_DIR / "index.html")
