import { useState, useEffect } from "react";
import axios from "axios";
import { Calculator, Users, Clock, Truck } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { toast, Toaster } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api/uk`;

const FENCE_TYPES = [
  { value: "OR", label: "OR - (270m/day)", productivity: 270 },
  { value: "PR", label: "PR - (60m/day)", productivity: 60 },
  { value: "CM", label: "CM - (60m/day)", productivity: 60 },
  { value: "CT", label: "CT - (60m/day)", productivity: 60 },
  { value: "HM", label: "HM - (60m/day)", productivity: 60 },
];

const UKCalculator = ({ onLogout, onSwitchCalculator }) => {
  const [fenceTypes, setFenceTypes] = useState([]);
  const [calculations, setCalculations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [showWorstCase, setShowWorstCase] = useState(false);

  const [formData, setFormData] = useState({
    user_name: "",
    delivery_lead: "",
    delivery_copilot: "",
    project_name: "",
    fence_type: "",
    meters: "",
    gates: "",
    is_time_sensitive: false,
    days_available: "",
    num_labourers: "",
    custom_fence_name: "",
    custom_daily_rate: "",
    driving_hours: ""
  });

  const [result, setResult] = useState(null);

  useEffect(() => {
    fetchFenceTypes();
    fetchCalculations();
  }, []);

  const fetchFenceTypes = async () => {
    try {
      const response = await axios.get(`${API}/fence-types`);
      setFenceTypes(response.data.fence_types);
    } catch (error) {
      console.error("Error fetching fence types:", error);
      setFenceTypes(FENCE_TYPES.map(ft => ft.value));
    }
  };

  const fetchCalculations = async () => {
    try {
      const response = await axios.get(`${API}/calculations`);
      setCalculations(response.data);
    } catch (error) {
      console.error("Error fetching calculations:", error);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCalculate = async () => {
    const leadName = formData.delivery_lead || formData.user_name;

    if (!leadName || !formData.project_name || !formData.fence_type || !formData.meters || !formData.gates) {
      toast.error("Please fill in all required fields (Delivery Lead, Project, Type, Meters, Gates)");
      return;
    }

    if (formData.is_time_sensitive && !formData.days_available) {
      toast.error("Please specify the number of days available");
      return;
    }

    // Validate custom fence type fields
    if (formData.fence_type === "CUSTOM" && (!formData.custom_fence_name || !formData.custom_daily_rate)) {
      toast.error("Please fill in custom fence name and daily installation rate");
      return;
    }

    setLoading(true);
    try {
      const calculationData = {
        user_name: leadName,
        delivery_lead: formData.delivery_lead,
        delivery_copilot: formData.delivery_copilot,
        project_name: formData.project_name,
        fence_type: formData.fence_type === "CUSTOM" ? formData.custom_fence_name : formData.fence_type,
        meters: parseFloat(formData.meters),
        gates: parseInt(formData.gates),
        is_time_sensitive: formData.is_time_sensitive,
        days_available: formData.is_time_sensitive ? parseInt(formData.days_available) : null,
        num_labourers: !formData.is_time_sensitive && formData.num_labourers ? parseInt(formData.num_labourers) : null,
        custom_daily_rate: formData.fence_type === "CUSTOM" ? parseInt(formData.custom_daily_rate) : null,
        driving_hours: formData.driving_hours ? parseFloat(formData.driving_hours) : null
      };

      const response = await axios.post(`${API}/calculate-preview`, calculationData);
      setResult(response.data.calculation);
      toast.success("Calculation completed!");
    } catch (error) {
      console.error("Error calculating:", error);
      toast.error("Failed to calculate price");
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!result) return;

    setArchiving(true);
    try {
      await axios.post(`${API}/archive`, result);
      const listResponse = await axios.get(`${API}/calculations`);
      setCalculations(listResponse.data);
      toast.success(`Archived! Total items: ${listResponse.data.length}`);
    } catch (error) {
      console.error("Error archiving:", error);
      toast.error("Failed to archive calculation");
    } finally {
      setArchiving(false);
    }
  };

  const handleReset = () => {
    setFormData({
      user_name: "",
      delivery_lead: "",
      delivery_copilot: "",
      project_name: "",
      fence_type: "",
      meters: "",
      gates: "",
      is_time_sensitive: false,
      days_available: "",
      num_labourers: "",
      custom_fence_name: "",
      custom_daily_rate: "",
      driving_hours: ""
    });
    setResult(null);
    setShowWorstCase(false);
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedIds(calculations.map(calc => calc.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id, checked) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter(selectedId => selectedId !== id));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) {
      toast.error("Please select at least one item to delete");
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} calculation(s)?`)) {
      return;
    }

    setDeleting(true);
    try {
      await axios.post(`${API}/delete-calculations`, { ids: selectedIds });
      const listResponse = await axios.get(`${API}/calculations`);
      setCalculations(listResponse.data);
      setSelectedIds([]);
      toast.success(`Deleted ${selectedIds.length} calculation(s)`);
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error("Failed to delete calculations");
    } finally {
      setDeleting(false);
    }
  };

  const getFenceTypeLabel = (value) => {
    const found = FENCE_TYPES.find(ft => ft.value === value);
    return found ? found.label : value;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster position="top-right" />

      <header className="bg-[#1E3A5F] border-b-2 border-[#152A47]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-white px-3 py-2 rounded-sm">
                <img
                  src="https://customer-assets.emergentagent.com/job_meter-price-tool/artifacts/a3m47d7y_NEW%20LOGO.png"
                  alt="Duralock Logo"
                  className="h-10 sm:h-12 w-auto"
                />
              </div>
              <div>
                <h1 className="font-heading text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Duracost UK - Installation
                </h1>
                <p className="text-slate-200 text-sm mt-1">UK Market Calculator - 2 Installation Agent Base</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={onSwitchCalculator}
                variant="outline"
                className="rounded-sm border-2 border-amber-400 text-amber-400 hover:bg-amber-400 hover:text-[#1E3A5F] transition-all duration-150"
              >
                International Calculator
              </Button>
              <Button
                onClick={onLogout}
                data-testid="logout-button"
                variant="outline"
                className="rounded-sm border-2 border-white text-white hover:bg-white hover:text-[#1E3A5F] transition-all duration-150"
              >
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          <div data-testid="input-panel" className="space-y-6">
            <Card className="rounded-sm border-2 border-slate-300 bg-white shadow-sm p-6">
              <h2 className="font-heading text-xl font-bold text-slate-900 mb-6 tracking-tight flex items-center gap-2">
                <Users className="w-5 h-5 text-[#1E3A5F]" />
                Project Details - UK Market
              </h2>

              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="delivery_lead" className="text-sm font-medium text-slate-700 mb-2 block">
                      Delivery Lead
                    </Label>
                    <Input
                      id="delivery_lead"
                      placeholder="Lead Name"
                      value={formData.delivery_lead}
                      onChange={(e) => handleInputChange("delivery_lead", e.target.value)}
                      className="rounded-sm border-2 border-slate-300 focus:border-[#1E3A5F] focus:ring-0 bg-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="delivery_copilot" className="text-sm font-medium text-slate-700 mb-2 block">
                      Delivery Co-pilot
                    </Label>
                    <Input
                      id="delivery_copilot"
                      placeholder="Co-pilot Name"
                      value={formData.delivery_copilot}
                      onChange={(e) => handleInputChange("delivery_copilot", e.target.value)}
                      className="rounded-sm border-2 border-slate-300 focus:border-[#1E3A5F] focus:ring-0 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="project_name" className="text-sm font-medium text-slate-700 mb-2 block">
                    Project Name
                  </Label>
                  <Input
                    id="project_name"
                    placeholder="Enter project name"
                    value={formData.project_name}
                    onChange={(e) => handleInputChange("project_name", e.target.value)}
                    className="rounded-sm border-2 border-slate-300 focus:border-[#1E3A5F] focus:ring-0 bg-white"
                  />
                </div>

                <div>
                  <Label htmlFor="fence_type" className="text-sm font-medium text-slate-700 mb-2 block">
                    Fence Type
                  </Label>
                  <Select value={formData.fence_type} onValueChange={(value) => {
                    handleInputChange("fence_type", value);
                    if (value !== "CUSTOM") {
                      handleInputChange("custom_fence_name", "");
                      handleInputChange("custom_daily_rate", "");
                    }
                  }}>
                    <SelectTrigger className="rounded-sm border-2 border-slate-300 focus:border-[#1E3A5F] focus:ring-0 bg-white">
                      <SelectValue placeholder="Select fence type" />
                    </SelectTrigger>
                    <SelectContent>
                      {FENCE_TYPES.map((ft) => (
                        <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>
                      ))}
                      <SelectItem value="CUSTOM">📝 Specify Fence Type / Daily Installation Ratio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.fence_type === "CUSTOM" && (
                  <div className="space-y-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-sm">
                    <div>
                      <Label htmlFor="custom_fence_name" className="text-sm font-medium text-slate-700 mb-2 block">
                        Custom Fence Type Name
                      </Label>
                      <Input
                        id="custom_fence_name"
                        placeholder="Enter fence type name (e.g., My Custom Fence)"
                        value={formData.custom_fence_name}
                        onChange={(e) => handleInputChange("custom_fence_name", e.target.value)}
                        className="rounded-sm border-2 border-slate-300 focus:border-[#1E3A5F] focus:ring-0 bg-white"
                      />
                    </div>
                    <div>
                      <Label htmlFor="custom_daily_rate" className="text-sm font-medium text-slate-700 mb-2 block">
                        Daily Installation Rate (meters/day)
                      </Label>
                      <Input
                        id="custom_daily_rate"
                        type="number"
                        placeholder="Enter daily rate (e.g., 50 for 50m/day)"
                        value={formData.custom_daily_rate}
                        onChange={(e) => handleInputChange("custom_daily_rate", e.target.value)}
                        className="rounded-sm border-2 border-slate-300 focus:border-[#1E3A5F] focus:ring-0 bg-white"
                      />
                      <p className="text-xs text-slate-500 mt-1">Enter only digits. Example: 50 means 50 meters per day</p>
                    </div>
                  </div>
                )}

                <div>
                  <Label htmlFor="meters" className="text-sm font-medium text-slate-700 mb-2 block">
                    Total Meters
                  </Label>
                  <Input
                    id="meters"
                    type="number"
                    placeholder="Enter total meters"
                    value={formData.meters}
                    onChange={(e) => handleInputChange("meters", e.target.value)}
                    className="rounded-sm border-2 border-slate-300 focus:border-[#1E3A5F] focus:ring-0 bg-white"
                  />
                </div>

                <div>
                  <Label htmlFor="gates" className="text-sm font-medium text-slate-700 mb-2 block">
                    Number of Gates
                  </Label>
                  <Input
                    id="gates"
                    type="number"
                    placeholder="Enter number of gates"
                    value={formData.gates}
                    onChange={(e) => handleInputChange("gates", e.target.value)}
                    className="rounded-sm border-2 border-slate-300 focus:border-[#1E3A5F] focus:ring-0 bg-white"
                  />
                </div>

                <Separator className="my-4" />

                <div className="bg-blue-50 border-2 border-blue-200 rounded-sm p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-blue-600" />
                      <Label htmlFor="is_time_sensitive" className="text-sm font-medium text-slate-900">
                        Is the project time sensitive?
                      </Label>
                    </div>
                    <Switch
                      id="is_time_sensitive"
                      checked={formData.is_time_sensitive}
                      onCheckedChange={(checked) => {
                        handleInputChange("is_time_sensitive", checked);
                        if (!checked) {
                          handleInputChange("days_available", "");
                        } else {
                          handleInputChange("num_labourers", "");
                        }
                      }}
                    />
                  </div>

                  {formData.is_time_sensitive ? (
                    <div>
                      <Label htmlFor="days_available" className="text-sm font-medium text-slate-700 mb-2 block">
                        How many days do we have for this project?
                      </Label>
                      <Input
                        id="days_available"
                        type="number"
                        placeholder="Enter number of days"
                        value={formData.days_available}
                        onChange={(e) => handleInputChange("days_available", e.target.value)}
                        className="rounded-sm border-2 border-slate-300 focus:border-blue-500 focus:ring-0 bg-white"
                      />
                      <p className="text-xs text-slate-500 mt-1">System will calculate required Installation Agents to meet deadline</p>
                    </div>
                  ) : (
                    <div>
                      <Label htmlFor="num_labourers" className="text-sm font-medium text-slate-700 mb-2 block">
                        How many Installation Agents required?
                      </Label>
                      <Input
                        id="num_labourers"
                        type="number"
                        placeholder="Leave empty for default (2 Installation Agents)"
                        value={formData.num_labourers}
                        onChange={(e) => handleInputChange("num_labourers", e.target.value)}
                        className="rounded-sm border-2 border-slate-300 focus:border-blue-500 focus:ring-0 bg-white"
                      />
                      <p className="text-xs text-slate-500 mt-1">Default: 2 Installation Agents if not specified</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  onClick={handleCalculate}
                  disabled={loading}
                  className="flex-1 rounded-sm border-2 border-[#1E3A5F] bg-[#1E3A5F] text-white hover:bg-[#152A47] shadow-none hover:shadow-[2px_2px_0px_0px_rgba(30,58,95,1)] transition-all duration-150 font-medium"
                >
                  {loading ? "Calculating..." : "Calculate Price"}
                </Button>
                <Button
                  onClick={handleReset}
                  variant="outline"
                  className="rounded-sm border-2 border-slate-300 hover:bg-slate-100 shadow-none transition-all duration-150"
                >
                  Reset
                </Button>
              </div>
            </Card>
          </div>

          <div data-testid="result-panel" className="space-y-6">
            {result ? (
              <Card className="rounded-sm border-2 border-slate-300 bg-white shadow-sm p-6 relative overflow-hidden">
                <div className="relative z-10">
                  <h2 className="font-heading text-xl font-bold text-slate-900 mb-4 tracking-tight">
                    Cost Breakdown - UK
                  </h2>

                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Project:</span>
                      <span className="font-medium text-slate-900">{result.project_name}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Fence Type:</span>
                      <span className="font-medium text-slate-900">{getFenceTypeLabel(result.fence_type)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Meters:</span>
                      <span className="font-mono font-medium text-slate-900">{result.meters}m</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Gates:</span>
                      <span className="font-mono font-medium text-slate-900">{result.gates}</span>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div className="space-y-3">
                    <div className="flex justify-between items-center bg-blue-50 rounded-sm p-2">
                      <span className="text-sm text-slate-600 flex items-center gap-1">
                        <Users className="w-4 h-4" /> Installation Agents Required:
                      </span>
                      <span className="font-mono font-bold text-blue-700">{result.breakdown.num_labourers} agents</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Work Days:</span>
                      <span className="font-mono font-medium text-slate-900">{result.breakdown.work_days} days</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Daily Rate per Man:</span>
                      <span className="font-mono font-medium text-[#1E3A5F]">£{result.breakdown.daily_rate_per_man.toFixed(2)}/day</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Installation Agent Cost:</span>
                      <span className="font-mono font-medium text-slate-900">£{result.breakdown.labor_cost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Tools Cost:</span>
                      <span className="font-mono font-medium text-slate-900">£{result.breakdown.tools_cost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Accommodation (£75/day/man):</span>
                      <span className="font-mono font-medium text-slate-900">£{result.breakdown.accommodation_cost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600 flex items-center gap-1">
                        <Truck className="w-4 h-4" /> Transportation:
                      </span>
                      <span className="font-mono font-medium text-slate-900">£{result.breakdown.transportation_cost.toFixed(2)}</span>
                    </div>
                    {result.breakdown.concrete_cost > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">Concrete Cost (£2/m):</span>
                        <span className="font-mono font-medium text-slate-900">£{result.breakdown.concrete_cost.toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  <Separator className="my-4" />

                  <div className="bg-slate-100 rounded-sm p-4 mb-6">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-heading text-lg font-bold text-slate-900">Raw Total:</span>
                      <span className="font-mono text-2xl font-bold text-slate-900">£{result.breakdown.raw_total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-slate-300 pt-2">
                      <span className="text-sm text-slate-600">Rate per Meter:</span>
                      <span className="font-mono font-bold text-[#1E3A5F]">£{result.breakdown.rate_per_meter.toFixed(2)}/m</span>
                    </div>
                  </div>

                  <h3 className="font-heading text-lg font-bold text-slate-900 mb-3 tracking-tight">
                    Markup Options
                  </h3>

                  <Button
                    onClick={() => setShowWorstCase(!showWorstCase)}
                    variant="outline"
                    className={`w-full mb-4 border-2 ${showWorstCase ? 'bg-slate-100 text-slate-700' : 'text-amber-600 border-amber-200 bg-amber-50 hover:bg-amber-100'}`}
                  >
                    {showWorstCase ? "Hide Worst Case Scenarios" : "Show Worst Case Scenarios"}
                  </Button>

                  {showWorstCase && (
                    <div className="space-y-3 mb-6 animate-in fade-in slide-in-from-top-4 duration-300">
                      <div className="bg-orange-50 border-2 border-orange-200 rounded-sm p-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-slate-900">Bad Case (+20%):</span>
                          <span className="font-mono font-bold text-orange-700">£{result.breakdown.bad_case_20?.toFixed(2) || (result.breakdown.raw_total * 1.2).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center mt-1 pt-1 border-t border-orange-200">
                          <span className="text-xs text-slate-500">Rate per Meter:</span>
                          <span className="font-mono text-sm text-orange-600">£{(result.breakdown.rate_per_meter * 1.2).toFixed(2)}/m</span>
                        </div>
                      </div>
                      <div className="bg-orange-100 border-2 border-orange-300 rounded-sm p-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-slate-900">More Bad Case (+40%):</span>
                          <span className="font-mono font-bold text-orange-800">£{result.breakdown.more_bad_case_40?.toFixed(2) || (result.breakdown.raw_total * 1.4).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center mt-1 pt-1 border-t border-orange-300">
                          <span className="text-xs text-slate-500">Rate per Meter:</span>
                          <span className="font-mono text-sm text-orange-700">£{(result.breakdown.rate_per_meter * 1.4).toFixed(2)}/m</span>
                        </div>
                      </div>
                      <div className="bg-red-100 border-2 border-red-300 rounded-sm p-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-slate-900">Worst Case (+80%):</span>
                          <span className="font-mono font-bold text-red-700">£{result.breakdown.worst_case_80?.toFixed(2) || (result.breakdown.raw_total * 1.8).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center mt-1 pt-1 border-t border-red-300">
                          <span className="text-xs text-slate-500">Rate per Meter:</span>
                          <span className="font-mono text-sm text-red-600">£{(result.breakdown.rate_per_meter * 1.8).toFixed(2)}/m</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 mb-6">
                    <div className="bg-amber-50 border-2 border-amber-200 rounded-sm p-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-900">+30% Markup:</span>
                        <span className="font-mono font-bold text-amber-700">£{result.breakdown.markup_30.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center mt-1 pt-1 border-t border-amber-200">
                        <span className="text-xs text-slate-500">Rate per Meter:</span>
                        <span className="font-mono text-sm text-amber-600">£{(result.breakdown.rate_per_meter * 1.3).toFixed(2)}/m</span>
                      </div>
                    </div>
                    <div className="bg-amber-50 border-2 border-amber-200 rounded-sm p-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-900">+40% Markup:</span>
                        <span className="font-mono font-bold text-amber-700">£{result.breakdown.markup_40.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center mt-1 pt-1 border-t border-amber-200">
                        <span className="text-xs text-slate-500">Rate per Meter:</span>
                        <span className="font-mono text-sm text-amber-600">£{(result.breakdown.rate_per_meter * 1.4).toFixed(2)}/m</span>
                      </div>
                    </div>
                    <div className="bg-amber-50 border-2 border-amber-200 rounded-sm p-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-900">+50% Markup:</span>
                        <span className="font-mono font-bold text-amber-700">£{result.breakdown.markup_50.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center mt-1 pt-1 border-t border-amber-200">
                        <span className="text-xs text-slate-500">Rate per Meter:</span>
                        <span className="font-mono text-sm text-amber-600">£{(result.breakdown.rate_per_meter * 1.5).toFixed(2)}/m</span>
                      </div>
                    </div>
                    <div className="bg-emerald-50 border-2 border-emerald-200 rounded-sm p-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-900">+60% Markup:</span>
                        <span className="font-mono font-bold text-emerald-700">£{result.breakdown.markup_60.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center mt-1 pt-1 border-t border-emerald-200">
                        <span className="text-xs text-slate-500">Rate per Meter:</span>
                        <span className="font-mono text-sm text-emerald-600">£{(result.breakdown.rate_per_meter * 1.6).toFixed(2)}/m</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={handleArchive}
                    disabled={archiving}
                    className="w-full rounded-sm border-2 border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 shadow-none hover:shadow-[2px_2px_0px_0px_rgba(5,150,105,1)] transition-all duration-150 font-medium"
                  >
                    {archiving ? "Archiving..." : "Archive This Calculation"}
                  </Button>
                </div>
              </Card>
            ) : (
              <Card className="rounded-sm border-2 border-slate-300 bg-white shadow-sm p-12 text-center">
                <Calculator className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                <h3 className="font-heading text-lg font-bold text-slate-900 mb-2">
                  No Calculation Yet
                </h3>
                <p className="text-slate-600 text-sm">
                  Fill in the project details and click Calculate to see pricing
                </p>
              </Card>
            )}
          </div>
        </div>

        <div className="mt-8">
          <Card className="rounded-sm border-2 border-slate-300 bg-white shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-xl font-bold text-slate-900 tracking-tight">
                UK Archived Calculations
              </h2>
              <Button
                onClick={handleDeleteSelected}
                disabled={deleting || selectedIds.length === 0}
                variant="destructive"
                className="rounded-sm"
              >
                {deleting ? "Deleting..." : `Delete Selected (${selectedIds.length})`}
              </Button>
            </div>

            {calculations.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No archived calculations yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-slate-200">
                      <th className="text-left py-3 px-2">
                        <Checkbox
                          checked={selectedIds.length === calculations.length && calculations.length > 0}
                          onCheckedChange={handleSelectAll}
                        />
                      </th>
                      <th className="text-left py-3 px-2 font-medium text-slate-700">Date</th>
                      <th className="text-left py-3 px-2 font-medium text-slate-700">Lead / Co-pilot</th>
                      <th className="text-left py-3 px-2 font-medium text-slate-700">Project</th>
                      <th className="text-left py-3 px-2 font-medium text-slate-700">Type</th>
                      <th className="text-right py-3 px-2 font-medium text-slate-700">Meters</th>
                      <th className="text-right py-3 px-2 font-medium text-slate-700">Agents</th>
                      <th className="text-right py-3 px-2 font-medium text-slate-700">Days</th>
                      <th className="text-right py-3 px-2 font-medium text-slate-700">Total</th>
                      <th className="text-right py-3 px-2 font-medium text-slate-700">Rate/m</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calculations.map((calc) => (
                      <tr key={calc.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 px-2">
                          <Checkbox
                            checked={selectedIds.includes(calc.id)}
                            onCheckedChange={(checked) => handleSelectRow(calc.id, checked)}
                          />
                        </td>
                        <td className="py-3 px-2 text-slate-600">
                          {new Date(calc.timestamp).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-2">
                          <div className="font-medium text-slate-900">{calc.delivery_lead || calc.user_name}</div>
                          {calc.delivery_copilot && (
                            <div className="text-xs text-slate-500 flex items-center gap-1">
                              <span className="opacity-50">w/</span> {calc.delivery_copilot}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-2">{calc.project_name}</td>
                        <td className="py-3 px-2">{calc.fence_type}</td>
                        <td className="py-3 px-2 text-right font-mono">{calc.meters}m</td>
                        <td className="py-3 px-2 text-right font-mono">{calc.num_labourers}</td>
                        <td className="py-3 px-2 text-right font-mono">{calc.breakdown.work_days}</td>
                        <td className="py-3 px-2 text-right font-mono font-medium">£{calc.breakdown.raw_total.toFixed(2)}</td>
                        <td className="py-3 px-2 text-right font-mono text-[#1E3A5F]">£{calc.breakdown.rate_per_meter.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
};

export default UKCalculator;
