import { useState, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import axios from "axios";
import { Calculator, Lock } from "lucide-react";
import UKCalculator from "@/UKCalculator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast, Toaster } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const CORRECT_PASSWORD = "DFS_1991..";

const Login = ({ onLogin }) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === CORRECT_PASSWORD) {
      localStorage.setItem("duracost_auth", "true");
      onLogin();
      toast.success("Access granted!");
    } else {
      setError(true);
      toast.error("Incorrect password");
      setPassword("");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 rounded-sm border-2 border-slate-300">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#2D4A2B] rounded-sm mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-slate-900 mb-2">
            Duracost - Installation
          </h1>
          <p className="text-slate-600 text-sm">Enter password to access the calculator</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="password" className="text-sm font-medium text-slate-700 mb-2 block">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              data-testid="password-input"
              placeholder="Enter password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(false);
              }}
              className={`rounded-sm border-2 ${error ? 'border-red-500' : 'border-slate-300'} focus:border-amber-500 focus:ring-0 bg-white`}
              autoFocus
            />
            {error && (
              <p className="text-red-500 text-sm mt-1">Incorrect password. Please try again.</p>
            )}
          </div>

          <Button
            type="submit"
            data-testid="login-button"
            className="w-full rounded-sm border-2 border-slate-900 bg-slate-900 text-white hover:bg-slate-800 shadow-none hover:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-all duration-150 font-medium"
          >
            Access Calculator
          </Button>
        </form>
      </Card>
    </div>
  );
};

const Home = ({ onLogout, onSwitchToUK }) => {
  const [countries, setCountries] = useState([]);
  const [calculations, setCalculations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [showWorstCase, setShowWorstCase] = useState(false);

  const [formData, setFormData] = useState({
    user_name: "",
    project_name: "",
    country: "",
    fence_type: "",
    meters: "",
    gates: "",
    ground_fixing_method: "Angle Steel"
  });

  const [result, setResult] = useState(null);

  useEffect(() => {
    fetchCountries();
    fetchCalculations();
  }, []);

  const fetchCountries = async () => {
    try {
      const response = await axios.get(`${API}/countries`);
      setCountries(response.data.countries);
    } catch (error) {
      console.error("Error fetching countries:", error);
      toast.error("Failed to load countries");
    }
  };

  const fetchCalculations = async () => {
    try {
      const response = await axios.get(`${API}/calculations`);
      console.log("Fetched calculations:", response.data);
      setCalculations(response.data);
    } catch (error) {
      console.error("Error fetching calculations:", error);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCalculate = async () => {
    if (!formData.user_name || !formData.project_name || !formData.country ||
      !formData.fence_type || !formData.meters || !formData.gates) {
      toast.error("Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      const calculationData = {
        user_name: formData.user_name,
        project_name: formData.project_name,
        country: formData.country,
        fence_type: formData.fence_type,
        meters: parseFloat(formData.meters),
        gates: parseInt(formData.gates),
        ground_fixing_method: formData.ground_fixing_method
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
      const archiveResponse = await axios.post(`${API}/archive`, result);
      console.log("Archive response:", archiveResponse.data);

      const listResponse = await axios.get(`${API}/calculations`);
      console.log("Updated calculations:", listResponse.data);
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
      project_name: "",
      country: "",
      fence_type: "",
      meters: "",
      gates: "",
      ground_fixing_method: "Angle Steel"
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

  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster position="top-right" />

      <header className="bg-[#2D4A2B] border-b-2 border-[#234520]">
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
                  Duracost - Installation
                </h1>
                <p className="text-slate-200 text-sm mt-1">Calculate installation costs per meter</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={onSwitchToUK}
                variant="outline"
                className="rounded-sm border-2 border-amber-400 text-amber-400 hover:bg-amber-400 hover:text-[#2D4A2B] transition-all duration-150"
              >
                UK Calculator
              </Button>
              <Button
                onClick={onLogout}
                data-testid="logout-button"
                variant="outline"
                className="rounded-sm border-2 border-white text-white hover:bg-white hover:text-[#2D4A2B] transition-all duration-150"
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
              <h2 className="font-heading text-xl font-bold text-slate-900 mb-6 tracking-tight">
                Project Details
              </h2>

              <div className="space-y-5">
                <div>
                  <Label htmlFor="user_name" className="text-sm font-medium text-slate-700 mb-2 block">
                    Your Name
                  </Label>
                  <Input
                    id="user_name"
                    data-testid="user-name-input"
                    placeholder="Enter your name"
                    value={formData.user_name}
                    onChange={(e) => handleInputChange("user_name", e.target.value)}
                    className="rounded-sm border-2 border-slate-300 focus:border-amber-500 focus:ring-0 bg-white"
                  />
                </div>

                <div>
                  <Label htmlFor="project_name" className="text-sm font-medium text-slate-700 mb-2 block">
                    Project Name
                  </Label>
                  <Input
                    id="project_name"
                    data-testid="project-name-input"
                    placeholder="Enter project name"
                    value={formData.project_name}
                    onChange={(e) => handleInputChange("project_name", e.target.value)}
                    className="rounded-sm border-2 border-slate-300 focus:border-amber-500 focus:ring-0 bg-white"
                  />
                </div>

                <div>
                  <Label htmlFor="country" className="text-sm font-medium text-slate-700 mb-2 block">
                    Country
                  </Label>
                  <Select value={formData.country} onValueChange={(value) => handleInputChange("country", value)}>
                    <SelectTrigger data-testid="country-select" className="rounded-sm border-2 border-slate-300 focus:border-amber-500 focus:ring-0 bg-white">
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      {countries.map((country) => (
                        <SelectItem key={country} value={country}>{country}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="fence_type" className="text-sm font-medium text-slate-700 mb-2 block">
                    Fence Types
                  </Label>
                  <Select value={formData.fence_type} onValueChange={(value) => handleInputChange("fence_type", value)}>
                    <SelectTrigger data-testid="fence-type-select" className="rounded-sm border-2 border-slate-300 focus:border-amber-500 focus:ring-0 bg-white">
                      <SelectValue placeholder="Select fence type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OR">OR - Oval Running Rail (136m/day)</SelectItem>
                      <SelectItem value="PR1">PR1</SelectItem>
                      <SelectItem value="PR2">PR2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="ground_fixing_method" className="text-sm font-medium text-slate-700 mb-2 block">
                    Ground Fixing Method
                  </Label>
                  <Select value={formData.ground_fixing_method} onValueChange={(value) => handleInputChange("ground_fixing_method", value)}>
                    <SelectTrigger data-testid="ground-fixing-method-select" className="rounded-sm border-2 border-slate-300 focus:border-amber-500 focus:ring-0 bg-white">
                      <SelectValue placeholder="Select ground fixing method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Angle Steel">Angle Steel</SelectItem>
                      <SelectItem value="Inner GMS Post with Baseplate">Inner GMS Post with Baseplate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="meters" className="text-sm font-medium text-slate-700 mb-2 block">
                    Total Meters
                  </Label>
                  <Input
                    id="meters"
                    data-testid="meters-input"
                    type="number"
                    placeholder="Enter total meters"
                    value={formData.meters}
                    onChange={(e) => handleInputChange("meters", e.target.value)}
                    className="rounded-sm border-2 border-slate-300 focus:border-amber-500 focus:ring-0 bg-white"
                  />
                </div>

                <div>
                  <Label htmlFor="gates" className="text-sm font-medium text-slate-700 mb-2 block">
                    Number of Gates
                  </Label>
                  <Input
                    id="gates"
                    data-testid="gates-input"
                    type="number"
                    placeholder="Enter number of gates"
                    value={formData.gates}
                    onChange={(e) => handleInputChange("gates", e.target.value)}
                    className="rounded-sm border-2 border-slate-300 focus:border-amber-500 focus:ring-0 bg-white"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  data-testid="calculate-button"
                  onClick={handleCalculate}
                  disabled={loading}
                  className="flex-1 rounded-sm border-2 border-slate-900 bg-slate-900 text-white hover:bg-slate-800 shadow-none hover:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-all duration-150 font-medium"
                >
                  {loading ? "Calculating..." : "Calculate Price"}
                </Button>
                <Button
                  data-testid="reset-button"
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
              <Card className="rounded-sm border-2 border-slate-300 bg-white shadow-sm p-6 grid-pattern relative overflow-hidden">
                <div className="absolute inset-0 bg-white/90 z-0"></div>
                <div className="relative z-10">
                  <h2 className="font-heading text-xl font-bold text-slate-900 mb-4 tracking-tight">
                    Cost Breakdown
                  </h2>

                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Project:</span>
                      <span className="font-medium text-slate-900">{result.project_name}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Country:</span>
                      <span className="font-medium text-slate-900">{result.country}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Fence Type:</span>
                      <span className="font-medium text-slate-900">{result.fence_type}</span>
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
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Work Days:</span>
                      <span className="font-mono font-medium text-slate-900">{result.breakdown.work_days} days</span>
                    </div>
                    {result.breakdown.daily_rate_per_man > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">Daily Rate per Man:</span>
                        <span className="font-mono font-medium text-amber-600">£{result.breakdown.daily_rate_per_man.toFixed(2)}/day</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Labour Cost (8 workers):</span>
                      <span className="font-mono font-medium text-slate-900">£{result.breakdown.labor_cost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Tools Cost:</span>
                      <span className="font-mono font-medium text-slate-900">£{result.breakdown.tools_cost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Supervision:</span>
                      <span className="font-mono font-medium text-slate-900">£{result.breakdown.supervision_cost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Flight Ticket:</span>
                      <span className="font-mono font-medium text-slate-900">£{result.breakdown.flight_ticket.toFixed(2)}</span>
                    </div>
                    {result.breakdown.ground_fixing_cost > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">Ground Fixing Cost:</span>
                        <span className="font-mono font-medium text-slate-900">£{result.breakdown.ground_fixing_cost.toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  <Separator className="my-4" />

                  <div className="bg-slate-100 rounded-sm p-4 mb-6">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-heading text-lg font-bold text-slate-900">Raw Total:</span>
                      <span data-testid="raw-total" className="font-mono text-2xl font-bold text-slate-900">£{result.breakdown.raw_total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-slate-300 pt-2">
                      <span className="text-sm text-slate-600">Rate per Meter:</span>
                      <span data-testid="rate-per-meter" className="font-mono font-bold text-amber-600">£{result.breakdown.rate_per_meter.toFixed(2)}/m</span>
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
                      <div className="flex justify-between items-center bg-orange-50 border-2 border-orange-200 rounded-sm p-3">
                        <span className="text-sm font-medium text-slate-900">Bad Case (+20%):</span>
                        <span className="font-mono font-bold text-orange-700">£{result.breakdown.bad_case_20?.toFixed(2) || (result.breakdown.raw_total * 1.2).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center bg-orange-100 border-2 border-orange-300 rounded-sm p-3">
                        <span className="text-sm font-medium text-slate-900">More Bad Case (+40%):</span>
                        <span className="font-mono font-bold text-orange-800">£{result.breakdown.more_bad_case_40?.toFixed(2) || (result.breakdown.raw_total * 1.4).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center bg-red-100 border-2 border-red-300 rounded-sm p-3">
                        <span className="text-sm font-medium text-slate-900">Worst Case (+80%):</span>
                        <span className="font-mono font-bold text-red-700">£{result.breakdown.worst_case_80?.toFixed(2) || (result.breakdown.raw_total * 1.8).toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 mb-6">
                    <div className="flex justify-between items-center bg-amber-50 border-2 border-amber-200 rounded-sm p-3">
                      <span className="text-sm font-medium text-slate-900">+30% Markup:</span>
                      <span data-testid="markup-30" className="font-mono font-bold text-amber-700">£{result.breakdown.markup_30.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center bg-amber-50 border-2 border-amber-200 rounded-sm p-3">
                      <span className="text-sm font-medium text-slate-900">+40% Markup:</span>
                      <span data-testid="markup-40" className="font-mono font-bold text-amber-700">£{result.breakdown.markup_40.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center bg-amber-50 border-2 border-amber-200 rounded-sm p-3">
                      <span className="text-sm font-medium text-slate-900">+50% Markup:</span>
                      <span data-testid="markup-50" className="font-mono font-bold text-amber-700">£{result.breakdown.markup_50.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center bg-emerald-50 border-2 border-emerald-200 rounded-sm p-3">
                      <span className="text-sm font-medium text-slate-900">+60% Markup:</span>
                      <span data-testid="markup-60" className="font-mono font-bold text-emerald-700">£{result.breakdown.markup_60.toFixed(2)}</span>
                    </div>
                  </div>

                  <Button
                    onClick={handleArchive}
                    disabled={archiving}
                    data-testid="archive-button"
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
                  Ready to Calculate
                </h3>
                <p className="text-sm text-slate-600">
                  Fill in the project details and click Calculate to see the pricing breakdown
                </p>
              </Card>
            )}
          </div>
        </div>

        <div data-testid="archive-section" className="mt-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-heading text-2xl font-bold text-slate-900 tracking-tight">
              Calculation Archive
            </h2>
            {selectedIds.length > 0 && (
              <Button
                onClick={handleDeleteSelected}
                disabled={deleting}
                data-testid="delete-selected-button"
                className="rounded-sm border-2 border-red-600 bg-red-600 text-white hover:bg-red-700 shadow-none hover:shadow-[2px_2px_0px_0px_rgba(220,38,38,1)] transition-all duration-150 font-medium"
              >
                {deleting ? "Deleting..." : `Delete Selected (${selectedIds.length})`}
              </Button>
            )}
          </div>

          <Card className="rounded-sm border-2 border-slate-300 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-900 border-b-2 border-slate-800">
                  <tr>
                    <th className="px-4 py-3 text-center text-xs font-bold text-white uppercase tracking-wide">
                      <input
                        type="checkbox"
                        checked={calculations.length > 0 && selectedIds.length === calculations.length}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="w-4 h-4 rounded border-white cursor-pointer"
                        data-testid="select-all-checkbox"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wide">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wide">Project</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wide">Country</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wide">Type</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-white uppercase tracking-wide">Meters</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-white uppercase tracking-wide">Gates</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-white uppercase tracking-wide">Raw Total</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-white uppercase tracking-wide">£/m</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wide">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {calculations.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="px-4 py-8 text-center text-sm text-slate-500">
                        No calculations yet. Create your first one above!
                      </td>
                    </tr>
                  ) : (
                    calculations.map((calc) => {
                      const ratePerMeter = calc.breakdown?.rate_per_meter
                        ? calc.breakdown.rate_per_meter.toFixed(2)
                        : (calc.breakdown?.raw_total && calc.meters
                          ? (calc.breakdown.raw_total / calc.meters).toFixed(2)
                          : "N/A");

                      const isSelected = selectedIds.includes(calc.id);

                      return (
                        <tr key={calc.id} data-testid="archive-row" className={`transition-colors duration-150 ${isSelected ? 'bg-red-50' : 'hover:bg-slate-50'}`}>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => handleSelectRow(calc.id, e.target.checked)}
                              className="w-4 h-4 rounded border-slate-300 cursor-pointer"
                              data-testid={`checkbox-${calc.id}`}
                            />
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-900 font-medium">{calc.user_name}</td>
                          <td className="px-4 py-3 text-sm text-slate-900">{calc.project_name}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{calc.country}</td>
                          <td className="px-4 py-3 text-sm font-mono text-slate-700">{calc.fence_type}</td>
                          <td className="px-4 py-3 text-sm font-mono text-right text-slate-700">{calc.meters}m</td>
                          <td className="px-4 py-3 text-sm font-mono text-right text-slate-700">{calc.gates}</td>
                          <td className="px-4 py-3 text-sm font-mono text-right font-medium text-slate-900">
                            £{calc.breakdown?.raw_total ? calc.breakdown.raw_total.toFixed(2) : "N/A"}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-right font-medium text-amber-600">
                            £{ratePerMeter}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">{new Date(calc.timestamp).toLocaleDateString()}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const auth = localStorage.getItem("duracost_auth");
    if (auth === "true") {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem("duracost_auth");
    setIsAuthenticated(false);
    toast.success("Logged out successfully");
  };

  if (!isAuthenticated) {
    return (
      <div className="App">
        <Toaster position="top-right" />
        <Login onLogin={handleLogin} />
      </div>
    );
  }

  return (
    <div className="App">
      <BrowserRouter>
        <AppRoutes onLogout={handleLogout} />
      </BrowserRouter>
    </div>
  );
}

function AppRoutes({ onLogout }) {
  const navigate = useNavigate();

  const handleSwitchToUK = () => {
    navigate("/uk");
  };

  const handleSwitchToInternational = () => {
    navigate("/");
  };

  return (
    <Routes>
      <Route path="/" element={<Home onLogout={onLogout} onSwitchToUK={handleSwitchToUK} />} />
      <Route path="/uk" element={<UKCalculator onLogout={onLogout} onSwitchCalculator={handleSwitchToInternational} />} />
    </Routes>
  );
}

export default App;
