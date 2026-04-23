import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  Truck, 
  Users, 
  Calendar, 
  FileText, 
  Settings, 
  MessageSquare, 
  Plus, 
  Search, 
  Bell, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight,
  Menu,
  X,
  TrendingUp,
  DollarSign,
  Fuel,
  ShieldCheck,
  Navigation,
  Package,
  ArrowRight,
  Calculator
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import Markdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';
import { APIProvider, Map, AdvancedMarker, Pin, useMap, useMapsLibrary, InfoWindow } from '@vis.gl/react-google-maps';

import { 
  REVENUE_DATA, 
  FLEET_STATUS_DATA, 
  COLORS, 
  RECENT_JOBS, 
  DRIVERS_DATA, 
  FLEET_DATA 
} from './constants';

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

// --- Utility ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

function RouteDisplay({ origin, destination, onRouteInfo }: {
  origin: string | google.maps.LatLngLiteral;
  destination: string | google.maps.LatLngLiteral;
  onRouteInfo?: (info: { distance: string; duration: string }) => void;
}) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    if (!routesLib || !map || !origin || !destination) return;
    // Clear previous route
    polylinesRef.current.forEach(p => p.setMap(null));

    (routesLib as any).Route.computeRoutes({
      origin,
      destination,
      travelMode: 'DRIVING',
      routingPreference: 'TRAFFIC_AWARE',
      extraComputations: ['TRAFFIC_ON_POLYLINE'],
      fields: ['path', 'speedPaths', 'distanceMeters', 'durationMillis', 'viewport'],
    }).then(({ routes }) => {
      if (routes?.[0]) {
        const newPolylines = routes[0].createPolylines();
        newPolylines.forEach(p => p.setMap(map));
        polylinesRef.current = newPolylines;
        if (routes[0].viewport) map.fitBounds(routes[0].viewport);
        
        if (onRouteInfo) {
          const km = (routes[0].distanceMeters / 1000).toFixed(1);
          const mins = Math.round(routes[0].durationMillis / 60000);
          onRouteInfo({ distance: `${km} km`, duration: `${mins} min` });
        }
      }
    }).catch(err => console.error("Route optimization error:", err));

    return () => polylinesRef.current.forEach(p => p.setMap(null));
  }, [routesLib, map, origin, destination]);

  return null;
}

// --- Hooks ---
const useSearch = <T extends any>(items: T[], query: string, keys: (keyof T)[]) => {
  return React.useMemo(() => {
    if (!query) return items;
    const lowerQuery = query.toLowerCase();
    return items.filter(item => 
      keys.some(key => String(item[key]).toLowerCase().includes(lowerQuery))
    );
  }, [items, query, keys]);
};

// --- Types ---
type View = 'dashboard' | 'fleet' | 'drivers' | 'jobs' | 'customers' | 'invoices' | 'ai' | 'driver' | 'compliance' | 'owner-portal' | 'partner-portal' | 'enroll-truck' | 'proposal' | 'outreach' | 'partner-quotes' | 'login';

interface DriverData {
  id: number;
  name: string;
  license_number: string;
  status: 'active' | 'on_leave' | 'inactive';
  assigned_truck?: string;
  phone: string;
}

interface TruckData {
  id: number;
  name: string;
  status: 'available' | 'busy' | 'maintenance';
  location_lat: number;
  location_lng: number;
  last_service_date: string;
  odometer: number;
  fuel_level: number;
  plate_number?: string;
  owner_id?: number | null;
}

interface JobData {
  id: number;
  customer_name: string;
  material: string;
  pickup_address: string;
  delivery_address: string;
  status: 'pending' | 'scheduled' | 'in_transit' | 'delivered' | 'cancelled';
  truck_id: number | null;
  truck_name?: string;
  driver_name?: string;
  price: number;
  distance_km?: number;
  earnings_owner?: number;
  scheduled_date: string;
  created_at: string;
}

// --- Mock Data for Charts (Deprecated - using constants.ts) ---

// --- Components ---

const Sidebar = React.memo(({ activeView, setView, onLogout, userRole }: { activeView: View, setView: (v: View) => void, onLogout: () => void, userRole: 'admin' | 'owner' | 'partner' | null }) => {
  const allItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin'] },
    { id: 'jobs', label: 'Jobs & Scheduling', icon: Calendar, roles: ['admin', 'owner', 'partner'] },
    { id: 'fleet', label: 'Fleet Management', icon: Truck, roles: ['admin', 'owner'] },
    { id: 'drivers', label: 'Driver Management', icon: Users, roles: ['admin'] },
    { id: 'invoices', label: 'Invoicing', icon: FileText, roles: ['admin'] },
    { id: 'ai', label: 'Dispatch AI', icon: MessageSquare, roles: ['admin'] },
    { id: 'driver', label: 'Driver App', icon: Navigation, roles: ['admin'] },
    { id: 'compliance', label: 'Compliance', icon: ShieldCheck, roles: ['admin'] },
    { id: 'owner-portal', label: 'Owner Portal', icon: Users, roles: ['admin', 'owner'] },
    { id: 'partner-portal', label: 'Partner Portal', icon: LayoutDashboard, roles: ['admin', 'partner'] },
    { id: 'enroll-truck', label: 'Enroll Truck', icon: Plus, roles: ['admin', 'owner'] },
    { id: 'proposal', label: 'Business Proposal', icon: FileText, roles: ['admin'] },
    { id: 'outreach', label: 'Partner Outreach', icon: Navigation, roles: ['admin', 'partner'] },
    { id: 'partner-quotes', label: 'Partner Quotes', icon: Calculator, roles: ['admin', 'partner'] },
  ];

  const menuItems = allItems.filter(item => {
    if (userRole === 'admin') return true;
    if (!userRole) return false;
    return item.roles.includes(userRole);
  });

  return (
    <div className="w-64 bg-slate-900 text-slate-300 h-screen flex flex-col border-r border-slate-800">
      <div className="p-6 flex items-center gap-3">
        <div className="bg-emerald-500 p-2 rounded-lg">
          <Truck className="text-white w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-white tracking-tight">TruckFlow OS</h1>
      </div>
      
      <nav className="flex-1 px-4 py-4 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id as View)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
                isActive 
                  ? "bg-emerald-500/10 text-emerald-500" 
                  : "hover:bg-slate-800 hover:text-white"
              )}
            >
              <Icon className={cn("w-5 h-5", isActive ? "text-emerald-500" : "text-slate-400 group-hover:text-white")} />
              <span className="font-medium">{item.label}</span>
              {isActive && <motion.div layoutId="active-pill" className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500" />}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800 space-y-4">
        <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/50">
          <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-xs">
            CEO
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">Admin User</p>
            <p className="text-xs text-slate-500 truncate">mngobeni11@gmail.com</p>
          </div>
          <Settings className="w-4 h-4 text-slate-500 cursor-pointer hover:text-white" />
        </div>
        <button 
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-500 transition-all group"
        >
          <X className="w-4 h-4 group-hover:text-red-500" />
          <span className="text-xs font-bold uppercase tracking-wider">Sign Out</span>
        </button>
      </div>
    </div>
  );
});

const Dashboard = ({ searchQuery }: { searchQuery: string }) => {
  const [stats, setStats] = useState({ totalJobs: 0, completedJobs: 0, activeTrucks: 0, revenue: 0 });
  const filteredJobs = useSearch(RECENT_JOBS, searchQuery, ['customer', 'id', 'route']);

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(() => {
        // Fallback if API fails
        setStats({ totalJobs: 42, completedJobs: 38, activeTrucks: 55, revenue: 324500 });
      });
  }, []);

  const statCards = [
    { label: 'Total Jobs', value: stats.totalJobs, icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Completed', value: stats.completedJobs, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Active Trucks', value: stats.activeTrucks, icon: Truck, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Total Revenue', value: `R${stats.revenue.toLocaleString()}`, icon: DollarSign, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Operations Overview</h2>
          <p className="text-slate-500 font-medium">Real-time performance metrics for your fleet.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Last 7 Days
          </button>
          <button className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Job
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, i) => (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            key={stat.label} 
            className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={cn("p-3 rounded-2xl transition-transform group-hover:scale-110", stat.bg)}>
                <stat.icon className={cn("w-6 h-6", stat.color)} />
              </div>
              <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">+12%</span>
            </div>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">{stat.label}</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{stat.value}</h3>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold text-slate-900">Revenue Performance</h3>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-xs font-bold text-slate-500">Revenue</span>
              </div>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={REVENUE_DATA}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} 
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#10b981" 
                  strokeWidth={4} 
                  dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} 
                  activeDot={{ r: 6, strokeWidth: 0 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="text-xl font-bold text-slate-900 mb-8">Fleet Status</h3>
          <div className="h-64 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={FLEET_STATUS_DATA}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {FLEET_STATUS_DATA.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-black text-slate-900">60</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Trucks</span>
            </div>
          </div>
          <div className="space-y-4 mt-6">
            {FLEET_STATUS_DATA.map((item, i) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                  <span className="text-sm font-bold text-slate-600">{item.name}</span>
                </div>
                <span className="text-sm font-black text-slate-900">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-900">Recent Shipments</h3>
          <button className="text-sm font-bold text-emerald-600 hover:text-emerald-700">View All Shipments</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Job ID</th>
                <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Customer</th>
                <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Route</th>
                <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Status</th>
                <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Amount</th>
                <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredJobs.map((job) => (
                <tr key={job.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-4 font-mono text-sm font-bold text-slate-900">{job.id}</td>
                  <td className="px-8 py-4">
                    <p className="font-bold text-slate-900">{job.customer}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{job.type}</p>
                  </td>
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      {job.route}
                    </div>
                  </td>
                  <td className="px-8 py-4">
                    <span className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest", 
                      job.status === 'Completed' ? "bg-emerald-50 text-emerald-600" :
                      job.status === 'In Transit' ? "bg-blue-50 text-blue-600" :
                      job.status === 'Scheduled' ? "bg-amber-50 text-amber-600" :
                      "bg-slate-50 text-slate-600"
                    )}>
                      {job.status}
                    </span>
                  </td>
                  <td className="px-8 py-4 font-black text-slate-900">{job.amount}</td>
                  <td className="px-8 py-4 text-right">
                    <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const FleetManagement = ({ searchQuery }: { searchQuery: string }) => {
  const [trucks, setTrucks] = useState<TruckData[]>([]);
  const [activeTab, setActiveTab] = useState<'internal' | 'outsource'>('internal');

  useEffect(() => {
    fetch('/api/trucks')
      .then(res => res.json())
      .then(data => setTrucks(data))
      .catch(() => {
        // Fallback to constants
        setTrucks(FLEET_DATA.map((t, i) => ({
          id: i + 1,
          name: t.model,
          status: t.status === 'Active' ? 'available' : t.status === 'Maintenance' ? 'maintenance' : 'busy',
          location_lat: -26.2041,
          location_lng: 28.0473,
          last_service_date: '2024-01-15',
          odometer: parseInt(t.mileage.replace(/[^0-9]/g, '')),
          fuel_level: parseInt(t.fuel.replace(/[^0-9]/g, '')),
          plate_number: `TF-${100 + i} GP`,
          owner_id: t.status === 'Idle' ? 1 : null // Mock owner for outsource
        })));
      });
  }, []);

  const internalFleet = trucks.filter(t => !t.owner_id);
  const outsourceFleet = trucks.filter(t => !!t.owner_id);

  const displayFleet = activeTab === 'internal' ? internalFleet : outsourceFleet;
  const filteredFleet = useSearch(displayFleet, searchQuery, ['name', 'plate_number']);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Fleet Management</h2>
          <p className="text-slate-500 font-medium">Monitor and maintain your vehicles in real-time.</p>
        </div>
        <button className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20">
          <Plus className="w-5 h-5" />
          Add Vehicle
        </button>
      </div>

      <div className="flex border-b border-slate-200">
        <button 
          onClick={() => setActiveTab('internal')}
          className={cn(
            "px-8 py-4 text-sm font-black uppercase tracking-widest transition-all relative",
            activeTab === 'internal' ? "text-emerald-600" : "text-slate-400 hover:text-slate-600"
          )}
        >
          Internal Fleet ({internalFleet.length})
          {activeTab === 'internal' && <motion.div layoutId="fleet-tab" className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500 rounded-t-full" />}
        </button>
        <button 
          onClick={() => setActiveTab('outsource')}
          className={cn(
            "px-8 py-4 text-sm font-black uppercase tracking-widest transition-all relative",
            activeTab === 'outsource' ? "text-emerald-600" : "text-slate-400 hover:text-slate-600"
          )}
        >
          Outsource Fleet ({outsourceFleet.length})
          {activeTab === 'outsource' && <motion.div layoutId="fleet-tab" className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500 rounded-t-full" />}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredFleet.map((truck) => (
          <motion.div 
            layout
            key={truck.id} 
            className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl transition-all group"
          >
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="bg-slate-50 p-3 rounded-2xl group-hover:bg-emerald-50 transition-colors">
                    <Truck className="w-6 h-6 text-slate-600 group-hover:text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900">{truck.name}</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{truck.plate_number}</p>
                  </div>
                </div>
                <span className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                  truck.status === 'available' ? "bg-emerald-50 text-emerald-600" :
                  truck.status === 'busy' ? "bg-blue-50 text-blue-600" :
                  "bg-amber-50 text-amber-600"
                )}>
                  {truck.status}
                </span>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest">
                    <span className="text-slate-400">Fuel Level</span>
                    <span className="text-slate-900">{truck.fuel_level}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${truck.fuel_level}%` }}
                      className={cn("h-full rounded-full transition-all duration-1000", 
                        truck.fuel_level > 50 ? "bg-emerald-500" : 
                        truck.fuel_level > 20 ? "bg-amber-500" : "bg-red-500"
                      )}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl">
                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Odometer</p>
                    <p className="text-sm font-black text-slate-900">{truck.odometer.toLocaleString()} km</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl">
                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Next Service</p>
                    <p className="text-sm font-black text-slate-900">In 2,400 km</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-slate-50 px-8 py-4 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                <MapPin className="w-4 h-4 text-slate-400" />
                <span>Johannesburg, GP</span>
              </div>
              <button className="text-emerald-600 text-xs font-black uppercase tracking-widest hover:text-emerald-700">View Details</button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const DriversManagementView = ({ searchQuery = '' }: { searchQuery?: string }) => {
  const [drivers, setDrivers] = useState<DriverData[]>([]);
  const [jobs, setJobs] = useState<JobData[]>([]);

  useEffect(() => {
    // Mock drivers
    setDrivers([
      { id: 1, name: 'John Doe', license_number: 'DL-12345678', status: 'active', assigned_truck: 'Scania R500', phone: '+27 82 123 4567' },
      { id: 2, name: 'Jane Smith', license_number: 'DL-87654321', status: 'active', assigned_truck: 'Volvo FH16', phone: '+27 83 987 6543' },
      { id: 3, name: 'Mike Johnson', license_number: 'DL-56781234', status: 'on_leave', assigned_truck: 'Mercedes Actros', phone: '+27 81 555 0199' },
    ]);

    fetch('/api/jobs')
      .then(res => res.json())
      .then(data => setJobs(data));
  }, []);

  const filteredDrivers = useSearch(drivers, searchQuery, ['name', 'license_number', 'assigned_truck', 'phone']);

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Driver Management</h2>
          <p className="text-slate-500">Manage your fleet's drivers and their assignments.</p>
        </div>
        <button className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors">
          <Plus className="w-5 h-5" />
          Add New Driver
        </button>
      </header>

      <div className="grid grid-cols-1 gap-6">
        {filteredDrivers.map(driver => (
          <div key={driver.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center border border-slate-200">
                  <Users className="w-8 h-8 text-slate-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{driver.name}</h3>
                  <p className="text-slate-500 text-sm font-medium">License: {driver.license_number}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-8 flex-1 max-w-2xl">
                <div>
                  <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Status</p>
                  <span className={cn(
                    "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                    driver.status === 'active' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                  )}>
                    {driver.status.replace('_', ' ')}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Assigned Truck</p>
                  <p className="text-sm font-bold text-slate-900">{driver.assigned_truck || 'Unassigned'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Contact</p>
                  <p className="text-sm font-bold text-slate-900">{driver.phone}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600">
                  <Settings className="w-5 h-5" />
                </button>
                <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Assigned Jobs</h4>
              <div className="space-y-2">
                {jobs.filter(j => j.driver_name === driver.name).length > 0 ? (
                  jobs.filter(j => j.driver_name === driver.name).map(job => (
                    <div key={job.id} className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Package className="w-4 h-4 text-slate-400" />
                        <div>
                          <p className="text-sm font-bold text-slate-900">{job.material} to {job.customer_name}</p>
                          <p className="text-xs text-slate-500">{job.pickup_address} → {job.delivery_address}</p>
                        </div>
                      </div>
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        job.status === 'delivered' ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                      )}>
                        {job.status.replace('_', ' ')}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic">No jobs assigned currently.</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const JobScheduling = () => {
  const [jobs, setJobs] = useState<JobData[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedJobForRoute, setSelectedJobForRoute] = useState<JobData | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);

  useEffect(() => {
    fetch('/api/jobs')
      .then(res => res.json())
      .then(data => setJobs(data));
  }, []);

  if (selectedJobForRoute) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => {
              setSelectedJobForRoute(null);
              setRouteInfo(null);
            }}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-bold text-sm"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
            Back to Job List
          </button>
          <div className="text-right">
            <h2 className="text-xl font-bold text-slate-900">Route Optimization</h2>
            <p className="text-xs text-slate-500">Real-time traffic-aware routing</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm h-[600px] relative">
            {!hasValidKey ? (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-50 p-8 text-center">
                <div className="max-w-md">
                  <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-slate-900 mb-2">Google Maps API Key Required</h3>
                  <p className="text-sm text-slate-500 mb-6">
                    To see live traffic and optimized routes, please add your Google Maps API key in the settings.
                  </p>
                  <div className="bg-white p-4 rounded-xl border border-slate-200 text-left text-xs space-y-2">
                    <p>1. Open <strong>Settings</strong> (⚙️ gear icon)</p>
                    <p>2. Go to <strong>Secrets</strong></p>
                    <p>3. Add <code>GOOGLE_MAPS_PLATFORM_KEY</code></p>
                  </div>
                </div>
              </div>
            ) : (
              <APIProvider apiKey={API_KEY} version="weekly">
                <Map
                  defaultCenter={{ lat: -26.2041, lng: 28.0473 }} // Johannesburg
                  defaultZoom={12}
                  mapId="DEMO_MAP_ID"
                  style={{ width: '100%', height: '100%' }}
                  {...({ internalUsageAttributionIds: ['gmp_mcp_codeassist_v1_aistudio'] } as any)}
                >
                  <RouteDisplay 
                    origin={selectedJobForRoute.pickup_address}
                    destination={selectedJobForRoute.delivery_address}
                    onRouteInfo={setRouteInfo}
                  />
                </Map>
              </APIProvider>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Navigation className="w-4 h-4 text-emerald-500" />
                Job Details
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Customer</p>
                  <p className="text-sm font-bold text-slate-900">{selectedJobForRoute.customer_name}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Pickup</p>
                  <p className="text-sm text-slate-600">{selectedJobForRoute.pickup_address}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Delivery</p>
                  <p className="text-sm text-slate-600">{selectedJobForRoute.delivery_address}</p>
                </div>
              </div>
            </div>

            {routeInfo && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 shadow-sm"
              >
                <h3 className="font-bold text-emerald-900 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  Optimized Route
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] text-emerald-600 uppercase font-black tracking-widest mb-1">Distance</p>
                    <p className="text-xl font-black text-emerald-900">{routeInfo.distance}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-emerald-600 uppercase font-black tracking-widest mb-1">Est. Time</p>
                    <p className="text-xl font-black text-emerald-900">{routeInfo.duration}</p>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-white/50 rounded-xl border border-emerald-100">
                  <p className="text-xs text-emerald-800 flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    Considering real-time traffic conditions
                  </p>
                </div>
              </motion.div>
            )}

            <button className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10">
              Confirm & Dispatch
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Jobs & Scheduling</h2>
          <p className="text-slate-500">Manage pickups, deliveries, and routing.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors"
        >
          <Plus className="w-5 h-5" />
          New Job Request
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-bottom border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Material</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Route</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Assigned Truck</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Price</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900">{job.customer_name}</div>
                    <div className="text-xs text-slate-500">{format(new Date(job.created_at), 'MMM d, h:mm a')}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-600">{job.material}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <span className="truncate max-w-[120px]">{job.pickup_address}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                      <span className="truncate max-w-[120px]">{job.delivery_address}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      job.status === 'delivered' ? "bg-emerald-100 text-emerald-700" :
                      job.status === 'in_transit' ? "bg-blue-100 text-blue-700" :
                      job.status === 'scheduled' ? "bg-amber-100 text-amber-700" :
                      "bg-slate-100 text-slate-700"
                    )}>
                      {job.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
                        <Truck className="w-3 h-3 text-slate-500" />
                      </div>
                      <span className="text-sm font-medium text-slate-700">{job.truck_name || 'Unassigned'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-900">
                    ${job.price.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => setSelectedJobForRoute(job)}
                      className="text-emerald-600 hover:text-emerald-700 font-bold text-xs flex items-center gap-1 ml-auto"
                    >
                      <Navigation className="w-3 h-3" />
                      Optimize
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const DispatchAI = () => {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([
    { role: 'assistant', content: "Hello! I'm your Intelligent Dispatch Assistant. I can help you with scheduling, fleet status, and operational insights. How can I assist you today?" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          { role: 'user', parts: [{ text: `You are a Dispatch Assistant for a trucking company. Context: We have 3 trucks (Truck 01: Available, Truck 02: Available, Truck 03: Maintenance). Current jobs: 5. Revenue today: $12,450. User query: ${userMessage}` }] }
        ],
        config: {
          systemInstruction: "You are a helpful, professional dispatch assistant for a trucking company called TruckFlow. You have access to real-time fleet and job data. Keep responses concise and actionable."
        }
      });

      setMessages(prev => [...prev, { role: 'assistant', content: response.text || "I'm sorry, I couldn't process that." }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'assistant', content: "Error connecting to AI service. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500 p-2 rounded-lg">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">Dispatch AI Assistant</h3>
            <p className="text-xs text-slate-500">Powered by Gemini 3 Flash</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-medium text-slate-500">Live Assistant</span>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg, i) => (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={i} 
            className={cn(
              "flex gap-4 max-w-[80%]",
              msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-xs",
              msg.role === 'user' ? "bg-blue-500 text-white" : "bg-emerald-500 text-white"
            )}>
              {msg.role === 'user' ? 'U' : 'AI'}
            </div>
            <div className={cn(
              "p-4 rounded-2xl text-sm leading-relaxed",
              msg.role === 'user' ? "bg-blue-500 text-white rounded-tr-none" : "bg-slate-100 text-slate-700 rounded-tl-none"
            )}>
              <Markdown>{msg.content}</Markdown>
            </div>
          </motion.div>
        ))}
        {isLoading && (
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs">AI</div>
            <div className="bg-slate-100 p-4 rounded-2xl rounded-tl-none">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-100">
        <div className="relative">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask anything (e.g., 'Which truck is closest to the quarry?')"
            className="w-full pl-4 pr-12 py-3 bg-slate-50 border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
          />
          <button 
            onClick={handleSend}
            disabled={isLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

const DriverApp = () => {
  const [activeJob, setActiveJob] = useState<JobData | null>(null);
  const [currentLocation, setCurrentLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [statusDetailed, setStatusDetailed] = useState<'IDLE' | 'EN_ROUTE_PICKUP' | 'ARRIVED_PICKUP' | 'LOADING' | 'EN_ROUTE_DELIVERY' | 'ARRIVED_DELIVERY'>('IDLE');
  const watchId = useRef<number | null>(null);

  useEffect(() => {
    // Simulate fetching assigned job
    fetch('/api/jobs')
      .then(res => res.json())
      .then(data => {
        const assigned = data.find((j: JobData) => j.status === 'scheduled' || j.status === 'in_transit');
        if (assigned) {
          setActiveJob(assigned);
          if (assigned.status === 'in_transit') {
            setStatusDetailed('EN_ROUTE_DELIVERY');
          } else {
            setStatusDetailed('IDLE');
          }
        }
      });

    // Setup GPS Tracking
    if ('geolocation' in navigator) {
      watchId.current = navigator.geolocation.watchPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => console.error("Geolocation error:", error),
        { enableHighAccuracy: true, maximumAge: 10000 }
      );
    }

    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, []);

  const updateStatus = (newStatus: typeof statusDetailed) => {
    setStatusDetailed(newStatus);
    // In a real app, we would also update the backend status
    if (activeJob) {
      const apiStatus = (newStatus === 'EN_ROUTE_DELIVERY' || newStatus === 'ARRIVED_DELIVERY') ? 'in_transit' : 
                        (newStatus === 'ARRIVED_PICKUP' || newStatus === 'LOADING') ? 'scheduled' : 'scheduled';
      
      // Simulate API update
      console.log(`Updating job ${activeJob.id} to status: ${apiStatus} (${newStatus})`);
    }
  };

  if (!activeJob) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-120px)] bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
        <div className="bg-slate-200 p-4 rounded-full mb-4">
          <Clock className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">No Active Jobs</h3>
        <p className="text-slate-500">You are currently on standby. New jobs will appear here.</p>
      </div>
    );
  }

  const getStatusLabel = () => {
    switch (statusDetailed) {
      case 'IDLE': return 'Waiting to Start';
      case 'EN_ROUTE_PICKUP': return 'En Route to Pickup';
      case 'ARRIVED_PICKUP': return 'Arrived at Pickup';
      case 'LOADING': return 'Loading Complete';
      case 'EN_ROUTE_DELIVERY': return 'En Route to Delivery';
      case 'ARRIVED_DELIVERY': return 'Arrived at Delivery';
      default: return 'Active';
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-4 pb-20">
      {/* Dynamic Map Header */}
      <div className="h-64 bg-slate-100 rounded-3xl overflow-hidden relative border border-slate-200 shadow-inner">
        {!hasValidKey ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50 p-6 text-center">
            <div>
              <MapPin className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs text-slate-500">Google Maps API Key required for real-time tracking visualization.</p>
            </div>
          </div>
        ) : (
          <APIProvider apiKey={API_KEY} version="weekly">
            <Map
              defaultCenter={currentLocation || { lat: -26.2041, lng: 28.0473 }}
              defaultZoom={15}
              center={currentLocation}
              mapId="DRIVER_APP_MAP"
              style={{ width: '100%', height: '100%' }}
              disableDefaultUI={true}
              {...({ internalUsageAttributionIds: ['gmp_mcp_codeassist_v1_aistudio'] } as any)}
            >
              {currentLocation && (
                <AdvancedMarker position={currentLocation}>
                  <div className="bg-blue-500 p-2 rounded-full ring-4 ring-blue-500/20 shadow-lg">
                    <Truck className="w-4 h-4 text-white" />
                  </div>
                </AdvancedMarker>
              )}
              <RouteDisplay 
                origin={activeJob.pickup_address}
                destination={activeJob.delivery_address}
              />
            </Map>
          </APIProvider>
        )}
        
        {/* Status Overlay */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center bg-white/90 backdrop-blur-md p-3 rounded-2xl shadow-lg border border-white/50">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
            <div>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest leading-none">GPS Active</p>
              <p className="text-sm font-bold text-slate-900 leading-tight mt-1">{getStatusLabel()}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest leading-none">ETA</p>
            <p className="text-sm font-bold text-slate-900 leading-tight mt-1">12:45 PM</p>
          </div>
        </div>
      </div>

      <div className="bg-emerald-600 text-white p-6 rounded-3xl shadow-lg">
        <div className="flex justify-between items-start mb-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest opacity-80">Current Task</span>
            <h3 className="text-2xl font-bold mt-1">Delivery to {activeJob.customer_name}</h3>
          </div>
          <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
            <Package className="w-6 h-6" />
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className={cn(
              "mt-1 w-3 h-3 rounded-full border-2 border-white",
              statusDetailed === 'IDLE' || statusDetailed === 'EN_ROUTE_PICKUP' ? "bg-white" : "bg-transparent opacity-50"
            )} />
            <div>
              <p className="text-xs opacity-80 uppercase font-bold">Pickup</p>
              <p className="font-medium text-sm">{activeJob.pickup_address}</p>
            </div>
          </div>
          <div className="w-0.5 h-6 bg-white/20 ml-1.5" />
          <div className="flex items-start gap-3">
            <div className={cn(
              "mt-1 w-3 h-3 rounded-full border-2 border-white",
              statusDetailed === 'EN_ROUTE_DELIVERY' ? "bg-amber-400 border-amber-400" : "bg-transparent opacity-50 text-amber-400"
            )} />
            <div>
              <p className="text-xs opacity-80 uppercase font-bold">Delivery</p>
              <p className="font-medium text-sm">{activeJob.delivery_address}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <div className="grid grid-cols-2 gap-4">
          {statusDetailed === 'IDLE' && (
            <button 
              onClick={() => updateStatus('EN_ROUTE_PICKUP')}
              className="col-span-2 bg-slate-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10"
            >
              <Navigation className="w-5 h-5" />
              Start: En Route to Pickup
            </button>
          )}
          {statusDetailed === 'EN_ROUTE_PICKUP' && (
            <button 
              onClick={() => updateStatus('ARRIVED_PICKUP')}
              className="col-span-2 bg-blue-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/10"
            >
              <MapPin className="w-5 h-5" />
              Arrived at Pickup
            </button>
          )}
          {statusDetailed === 'ARRIVED_PICKUP' && (
            <button 
              onClick={() => updateStatus('LOADING')}
              className="col-span-2 bg-emerald-500 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/10"
            >
              <Truck className="w-5 h-5" />
              Confirm Loading Complete
            </button>
          )}
          {statusDetailed === 'LOADING' && (
            <button 
              onClick={() => updateStatus('EN_ROUTE_DELIVERY')}
              className="col-span-2 bg-slate-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10"
            >
              <Navigation className="w-5 h-5" />
              Start: En Route to Delivery
            </button>
          )}
          {statusDetailed === 'EN_ROUTE_DELIVERY' && (
            <button 
              onClick={() => updateStatus('ARRIVED_DELIVERY')}
              className="col-span-2 bg-emerald-500 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/10"
            >
              <CheckCircle2 className="w-5 h-5" />
              Arrived at Delivery
            </button>
          )}
          {statusDetailed === 'ARRIVED_DELIVERY' && (
            <div className="col-span-2 text-center py-4 bg-emerald-50 rounded-2xl border border-emerald-100 italic text-emerald-800 font-bold">
              Job Complete. Waiting for system sync...
            </div>
          )}
        </div>

        <div className="flex gap-4">
          <button className="flex-1 bg-slate-50 border border-slate-200 text-slate-600 py-3 rounded-2xl font-bold hover:bg-slate-100 transition-colors flex items-center justify-center gap-2 text-sm">
            <FileText className="w-4 h-4" />
            POD Slip
          </button>
          <button className="flex-1 border-2 border-red-50 text-red-500 py-3 rounded-2xl font-bold hover:bg-red-50 transition-colors flex items-center justify-center gap-2 text-sm">
            <AlertCircle className="w-4 h-4" />
            Danger
          </button>
        </div>
      </div>
    </div>
  );
};

const InvoicesView = () => {
  const [invoices, setInvoices] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/invoices')
      .then(res => res.json())
      .then(data => setInvoices(data));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Invoicing & Payments</h2>
          <p className="text-slate-500">Track revenue and outstanding payments.</p>
        </div>
        <div className="flex gap-3">
          <button className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl font-medium hover:bg-slate-50 transition-colors">
            Export to CSV
          </button>
          <button className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors">
            <Plus className="w-5 h-5" />
            Generate Invoice
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-sm font-medium">Outstanding</p>
          <h3 className="text-2xl font-bold text-red-600 mt-1">$4,250.00</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-sm font-medium">Paid (This Month)</p>
          <h3 className="text-2xl font-bold text-emerald-600 mt-1">$12,450.00</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-sm font-medium">Overdue</p>
          <h3 className="text-2xl font-bold text-amber-600 mt-1">$850.00</h3>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-bottom border-slate-200">
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Invoice ID</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Customer</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Amount</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Due Date</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4 font-mono text-xs text-slate-500">INV-{inv.id.toString().padStart(4, '0')}</td>
                <td className="px-6 py-4 font-bold text-slate-900">{inv.customer_name}</td>
                <td className="px-6 py-4 font-bold text-slate-900">${inv.amount.toFixed(2)}</td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                    inv.status === 'paid' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                  )}>
                    {inv.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">{inv.due_date}</td>
                <td className="px-6 py-4">
                  <button className="text-emerald-600 hover:text-emerald-700 font-bold text-xs">Send Reminder</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ComplianceView = () => {
  const docs = [
    { id: 1, title: 'Operating Permit 2026', type: 'Permit', expiry: '2026-12-31', status: 'Valid' },
    { id: 2, title: 'Fleet Insurance Policy', type: 'Insurance', expiry: '2026-06-15', status: 'Valid' },
    { id: 3, title: 'Driver License - John Doe', type: 'License', expiry: '2026-04-20', status: 'Expiring Soon' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Compliance Vault</h2>
          <p className="text-slate-500">Manage permits, licenses, and safety documentation.</p>
        </div>
        <button className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors">
          <Plus className="w-5 h-5" />
          Upload Document
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {docs.map((doc) => (
          <div key={doc.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-slate-100 p-3 rounded-xl">
                <ShieldCheck className={cn("w-6 h-6", doc.status === 'Valid' ? "text-emerald-600" : "text-amber-600")} />
              </div>
              <span className={cn(
                "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                doc.status === 'Valid' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
              )}>
                {doc.status}
              </span>
            </div>
            <h4 className="font-bold text-slate-900 mb-1">{doc.title}</h4>
            <p className="text-xs text-slate-500 mb-4">{doc.type}</p>
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Clock className="w-3 h-3" />
                <span>Expires: {doc.expiry}</span>
              </div>
              <button className="text-emerald-600 text-xs font-bold hover:underline">View File</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const EnrollTruckView = ({ setView }: { setView: (v: View) => void }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    bank_account: '',
    truck_name: '',
    plate_number: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/owners/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        alert('Enrollment successful! You can now access the Owner Portal.');
        setView('owner-portal');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <header className="text-center">
        <h2 className="text-3xl font-bold text-slate-900">Partner with TruckFlow</h2>
        <p className="text-slate-500 mt-2">Enroll your truck and start earning today.</p>
      </header>

      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Full Name</label>
            <input 
              required
              type="text" 
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              className="w-full px-4 py-2 bg-slate-50 border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
              placeholder="John Doe"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Email Address</label>
            <input 
              required
              type="email" 
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
              className="w-full px-4 py-2 bg-slate-50 border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
              placeholder="john@example.com"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Phone Number</label>
            <input 
              required
              type="tel" 
              value={formData.phone}
              onChange={e => setFormData({...formData, phone: e.target.value})}
              className="w-full px-4 py-2 bg-slate-50 border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
              placeholder="012-345-6789"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Bank Account (EFT)</label>
            <input 
              required
              type="text" 
              value={formData.bank_account}
              onChange={e => setFormData({...formData, bank_account: e.target.value})}
              className="w-full px-4 py-2 bg-slate-50 border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
              placeholder="Account Number"
            />
          </div>
        </div>

        <div className="pt-6 border-t border-slate-100 space-y-6">
          <h3 className="font-bold text-slate-900">Vehicle Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Truck Name/Model</label>
              <input 
                required
                type="text" 
                value={formData.truck_name}
                onChange={e => setFormData({...formData, truck_name: e.target.value})}
                className="w-full px-4 py-2 bg-slate-50 border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                placeholder="e.g. Volvo FH16"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">License Plate Number</label>
              <input 
                required
                type="text" 
                value={formData.plate_number}
                onChange={e => setFormData({...formData, plate_number: e.target.value})}
                className="w-full px-4 py-2 bg-slate-50 border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                placeholder="ABC 123 GP"
              />
            </div>
          </div>
        </div>

        <button 
          disabled={isSubmitting}
          type="submit"
          className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-xl font-bold transition-colors disabled:opacity-50"
        >
          {isSubmitting ? 'Enrolling...' : 'Enroll My Truck'}
        </button>
      </form>
    </div>
  );
};

const OwnerPortalView = () => {
  const [stats, setStats] = useState<any>(null);
  const ownerId = 1; // Demo owner ID

  useEffect(() => {
    fetch(`/api/owners/${ownerId}/stats`)
      .then(res => res.json())
      .then(data => setStats(data));
  }, []);

  if (!stats) return <div className="p-8 text-center">Loading stats...</div>;

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Owner Dashboard</h2>
          <p className="text-slate-500">Welcome back, Mike. Here's how your fleet is performing.</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span className="text-sm font-medium text-slate-700">Verified Partner</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Earnings', value: `$${(stats.total_earnings || 0).toLocaleString()}`, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Trips Completed', value: stats.total_trips || 0, icon: Navigation, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Distance Covered', value: `${(stats.total_distance || 0).toFixed(1)} km`, icon: MapPin, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Active Trucks', value: stats.truck_count || 0, icon: Truck, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map((stat, i) => (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            key={stat.label} 
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
          >
            <div className={cn("p-3 rounded-xl w-fit mb-4", stat.bg)}>
              <stat.icon className={cn("w-6 h-6", stat.color)} />
            </div>
            <p className="text-slate-500 text-sm font-medium">{stat.label}</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</h3>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900">Recent Trips</h3>
            <button className="text-emerald-600 text-sm font-bold hover:underline">View All</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Truck</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Distance</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Earnings</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.recentTrips?.map((trip: any) => (
                  <tr key={trip.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-slate-600">{format(new Date(trip.created_at), 'MMM d')}</td>
                    <td className="px-6 py-4 font-bold text-slate-900">{trip.truck_name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{trip.distance_km} km</td>
                    <td className="px-6 py-4 font-bold text-emerald-600">${trip.earnings_owner.toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        trip.status === 'delivered' ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                      )}>
                        {trip.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-6">Payment History</h3>
          <div className="space-y-4">
            {[
              { date: 'Mar 1, 2026', amount: 4500.00, status: 'Paid' },
              { date: 'Feb 15, 2026', amount: 3800.00, status: 'Paid' },
              { date: 'Feb 1, 2026', amount: 5200.00, status: 'Paid' },
            ].map((payment, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                <div>
                  <p className="text-sm font-bold text-slate-900">${payment.amount.toLocaleString()}</p>
                  <p className="text-xs text-slate-500">{payment.date}</p>
                </div>
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">{payment.status}</span>
              </div>
            ))}
            <button className="w-full py-2 text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors">
              View Payment Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ProposalView = () => {
  return (
    <div className="max-w-4xl mx-auto py-12 px-6 bg-white rounded-3xl border border-slate-200 shadow-xl">
      <div className="flex justify-between items-start mb-12">
        <div>
          <div className="bg-emerald-500 w-16 h-16 rounded-2xl flex items-center justify-center mb-6">
            <Truck className="text-white w-10 h-10" />
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">TruckFlow OS</h1>
          <p className="text-xl text-slate-500 font-medium">Ultimate Business Operating System for Trucking</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Proposal v1.0</p>
          <p className="text-sm text-slate-500 mt-1">March 12, 2026</p>
        </div>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-3">
            <div className="w-1.5 h-8 bg-emerald-500 rounded-full" />
            Executive Summary
          </h2>
          <p className="text-slate-600 leading-relaxed text-lg">
            TruckFlow OS is a comprehensive, AI-driven business operating system designed specifically for the modern trucking industry. By integrating intelligent scheduling, real-time fleet management, and a unique "Uber-style" partner enrollment model, TruckFlow OS empowers business owners to scale operations, reduce overhead, and maximize profitability through data-driven decisions.
          </p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100">
            <h3 className="text-xl font-bold text-slate-900 mb-4">The Problem</h3>
            <ul className="space-y-3 text-slate-600">
              <li className="flex gap-3">
                <X className="w-5 h-5 text-red-500 shrink-0" />
                <span>Inefficient manual scheduling and route planning.</span>
              </li>
              <li className="flex gap-3">
                <X className="w-5 h-5 text-red-500 shrink-0" />
                <span>Lack of visibility into fleet performance and fuel costs.</span>
              </li>
              <li className="flex gap-3">
                <X className="w-5 h-5 text-red-500 shrink-0" />
                <span>Difficulty in scaling without massive capital investment in vehicles.</span>
              </li>
              <li className="flex gap-3">
                <X className="w-5 h-5 text-red-500 shrink-0" />
                <span>Disconnected driver communication and POD tracking.</span>
              </li>
            </ul>
          </div>
          <div className="bg-emerald-50 p-8 rounded-2xl border border-emerald-100">
            <h3 className="text-xl font-bold text-emerald-900 mb-4">The Solution</h3>
            <ul className="space-y-3 text-emerald-800">
              <li className="flex gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>AI-assisted dispatching and intelligent route optimization.</span>
              </li>
              <li className="flex gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>Real-time IoT-ready fleet monitoring and maintenance alerts.</span>
              </li>
              <li className="flex gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>"Uber-like" partner model to scale via outsourced fleets.</span>
              </li>
              <li className="flex gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>Integrated driver app for seamless POD and navigation.</span>
              </li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Key Strategic Features</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { title: "Intelligent Scheduling", desc: "Auto-assign closest trucks based on location and load capacity." },
              { title: "Dynamic Pricing Engine", desc: "Calculate instant quotes based on distance, material, and urgency." },
              { title: "Fleet Maintenance AI", desc: "Predictive alerts for oil changes, brakes, and tire rotations." },
              { title: "Owner Portal", desc: "Dedicated dashboard for outsourced partners to track their earnings." },
              { title: "Dispatch Assistant", desc: "Natural language AI to query fleet status and job performance." },
              { title: "Compliance Vault", desc: "Automated tracking of licenses, permits, and insurance expiry." }
            ].map((feature, i) => (
              <div key={i} className="p-4 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors">
                <h4 className="font-bold text-slate-900 mb-1">{feature.title}</h4>
                <p className="text-sm text-slate-500">{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-slate-900 text-white p-10 rounded-3xl">
          <div className="flex flex-col md:flex-row gap-10 items-center">
            <div className="flex-1">
              <h2 className="text-3xl font-bold mb-4">Projected Business Impact</h2>
              <p className="text-slate-400 mb-6">Implementing TruckFlow OS is expected to deliver significant ROI within the first 6 months of operation.</p>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-3xl font-black text-emerald-400">30%</p>
                  <p className="text-sm text-slate-400">Reduction in Fuel Costs</p>
                </div>
                <div>
                  <p className="text-3xl font-black text-emerald-400">2.5x</p>
                  <p className="text-sm text-slate-400">Fleet Scaling Speed</p>
                </div>
                <div>
                  <p className="text-3xl font-black text-emerald-400">40%</p>
                  <p className="text-sm text-slate-400">Less Admin Overhead</p>
                </div>
                <div>
                  <p className="text-3xl font-black text-emerald-400">98%</p>
                  <p className="text-sm text-slate-400">Customer Satisfaction</p>
                </div>
              </div>
            </div>
            <div className="w-full md:w-64 bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20">
              <TrendingUp className="w-12 h-12 text-emerald-400 mb-4" />
              <p className="text-sm font-medium leading-relaxed">"TruckFlow OS isn't just a tool; it's the engine that drives your business growth in a competitive logistics landscape."</p>
            </div>
          </div>
        </section>

        <section className="text-center pt-8 border-t border-slate-100">
          <p className="text-slate-500 mb-6 font-medium">Ready to revolutionize your trucking operations?</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-emerald-500 text-white px-8 py-4 rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20">
              Approve Proposal
            </button>
            <button className="bg-slate-100 text-slate-700 px-8 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-all">
              Download PDF
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

const PartnerOutreachView = () => {
  const [stats, setStats] = useState<any>(null);
  const [proposal, setProposal] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then(res => res.json())
      .then(data => {
        setStats(data);
        generateProposal(data);
      });
  }, []);

  const generateProposal = async (currentStats: any) => {
    setIsLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          { role: 'user', parts: [{ text: `Generate a professional B2B partnership proposal for a trucking company. 
          Context: We are TruckFlow OS. We have high demand. 
          Current Stats: ${currentStats.totalJobs} total jobs, ${currentStats.activeTrucks} active trucks. 
          Goal: Invite other fleet owners to join our "Outsource Fleet" to handle excess demand. 
          Highlight: Guaranteed jobs, real-time tracking, and fair revenue sharing.` }] }
        ],
        config: {
          systemInstruction: "You are a professional business development manager. Write a persuasive, concise partnership proposal."
        }
      });
      setProposal(response.text || "Failed to generate proposal.");
    } catch (error) {
      console.error(error);
      setProposal("Error generating proposal. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Partner Outreach</h2>
          <p className="text-slate-500">Generate data-driven proposals for potential fleet partners.</p>
        </div>
        <button 
          onClick={() => stats && generateProposal(stats)}
          disabled={isLoading}
          className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
        >
          <Plus className="w-5 h-5" />
          Regenerate Proposal
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-sm font-medium">Current Demand</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats?.totalJobs || 0} Jobs</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-sm font-medium">Available Capacity</p>
          <h3 className="text-2xl font-bold text-amber-600 mt-1">{stats?.activeTrucks || 0} Active</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-sm font-medium">Opportunity Gap</p>
          <h3 className="text-2xl font-bold text-emerald-600 mt-1">High</h3>
        </div>
      </div>

      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5">
          <Truck className="w-64 h-64" />
        </div>
        
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-4">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-500 font-medium">AI is crafting your proposal...</p>
          </div>
        ) : (
          <div className="prose prose-slate max-w-none">
            <div className="flex items-center gap-4 mb-8">
              <div className="bg-emerald-500 p-3 rounded-2xl">
                <FileText className="text-white w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Partnership Proposal</h3>
                <p className="text-sm text-slate-500">Generated on {new Date().toLocaleDateString()}</p>
              </div>
            </div>
            
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 mb-8">
              <div className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                <Markdown>{proposal}</Markdown>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button className="flex-1 bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
                <Navigation className="w-5 h-5" />
                Send to Potential Partners
              </button>
              <button className="flex-1 border-2 border-slate-200 text-slate-700 py-4 rounded-xl font-bold hover:bg-slate-50 transition-all">
                Copy to Clipboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const PartnerQuotesView = () => {
  const [partner, setPartner] = useState('Keys Movers');
  const [baseCost, setBaseCost] = useState(4750);
  const [moveDate, setMoveDate] = useState(new Date().toISOString().split('T')[0]);
  const [packingService, setPackingService] = useState(0);
  const [valueOfGoods, setValueOfGoods] = useState(0);
  const [insuranceType, setInsuranceType] = useState<'none' | 'total-loss' | 'all-risk'>('none');
  const [miscItems, setMiscItems] = useState<{ name: string, price: number, qty: number }[]>([
    { name: 'Buff Tape', price: 30, qty: 0 },
    { name: 'Standard Box', price: 60, qty: 0 },
  ]);

  const calculateTotal = () => {
    const date = new Date(moveDate);
    const dayOfMonth = date.getDate();
    const dayOfWeek = date.getDay(); // 0 is Sunday, 6 is Saturday

    // T (Timing Adjustment)
    // R0 for Mid Month (6th–24th); R500 for End Month (25th–5th)
    const T = (dayOfMonth >= 25 || dayOfMonth <= 5) ? 500 : 0;

    // S (Day Surcharge)
    // R0 for weekdays; R650 for Saturday; R1,650 for Sunday/Holidays
    let S = 0;
    if (dayOfWeek === 6) S = 650;
    else if (dayOfWeek === 0) S = 1650;

    // P (Packing Service)
    const P = packingService;

    // V * I (Insurance)
    const V = valueOfGoods;
    const I = insuranceType === 'total-loss' ? 0.015 : (insuranceType === 'all-risk' ? 0.025 : 0);
    const insuranceCost = V * I;

    // M (Miscellaneous)
    const M = miscItems.reduce((acc, item) => acc + (item.price * item.qty), 0);

    // C = (B + T) + S + P + (V * I) + M
    const total = (baseCost + T) + S + P + insuranceCost + M;

    return { total, T, S, P, insuranceCost, M };
  };

  const { total, T, S, P, insuranceCost, M } = calculateTotal();

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Partner Quotes</h2>
          <p className="text-slate-500">Calculate moving costs based on partner-specific formulas.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Partner:</span>
          <select 
            value={partner}
            onChange={(e) => setPartner(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
          >
            <option>Keys Movers</option>
          </select>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-emerald-500" />
              Quote Calculator
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">Base Move Cost (B)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R</span>
                  <input 
                    type="number"
                    value={baseCost}
                    onChange={(e) => setBaseCost(Number(e.target.value))}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-emerald-500 rounded-xl font-bold text-slate-900 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">Move Date (for T & S)</label>
                <input 
                  type="date"
                  value={moveDate}
                  onChange={(e) => setMoveDate(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-emerald-500 rounded-xl font-bold text-slate-900 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">Packing Service (P)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R</span>
                  <input 
                    type="number"
                    value={packingService}
                    onChange={(e) => setPackingService(Number(e.target.value))}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-emerald-500 rounded-xl font-bold text-slate-900 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">Value of Goods (V)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R</span>
                  <input 
                    type="number"
                    value={valueOfGoods}
                    onChange={(e) => setValueOfGoods(Number(e.target.value))}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-emerald-500 rounded-xl font-bold text-slate-900 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">Insurance Type (I)</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'none', label: 'None', rate: '0%' },
                    { id: 'total-loss', label: 'Total Loss', rate: '1.5%' },
                    { id: 'all-risk', label: 'All Risk', rate: '2.5%' },
                  ].map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setInsuranceType(type.id as any)}
                      className={cn(
                        "py-3 rounded-xl font-bold text-sm transition-all border-2",
                        insuranceType === type.id 
                          ? "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20" 
                          : "bg-white border-slate-100 text-slate-500 hover:border-slate-200"
                      )}
                    >
                      {type.label}
                      <span className="block text-[10px] opacity-80">{type.rate}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Miscellaneous Items (M)</h4>
              <div className="space-y-3">
                {miscItems.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                    <div>
                      <p className="font-bold text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500">R{item.price} per unit</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => {
                          const newItems = [...miscItems];
                          newItems[idx].qty = Math.max(0, newItems[idx].qty - 1);
                          setMiscItems(newItems);
                        }}
                        className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-50"
                      >
                        -
                      </button>
                      <span className="w-8 text-center font-bold text-slate-900">{item.qty}</span>
                      <button 
                        onClick={() => {
                          const newItems = [...miscItems];
                          newItems[idx].qty += 1;
                          setMiscItems(newItems);
                        }}
                        className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-50"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl sticky top-8">
            <h3 className="text-xl font-bold mb-8 border-b border-white/10 pb-4">Quote Summary</h3>
            
            <div className="space-y-4 mb-8">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Base Cost (B)</span>
                <span className="font-bold">R{baseCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Timing Adjustment (T)</span>
                <span className={cn("font-bold", T > 0 ? "text-amber-400" : "text-emerald-400")}>+ R{T.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Day Surcharge (S)</span>
                <span className={cn("font-bold", S > 0 ? "text-amber-400" : "text-emerald-400")}>+ R{S.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Packing Service (P)</span>
                <span className="font-bold">+ R{P.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Insurance (V × I)</span>
                <span className="font-bold">+ R{insuranceCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Miscellaneous (M)</span>
                <span className="font-bold">+ R{M.toLocaleString()}</span>
              </div>
            </div>

            <div className="pt-6 border-t border-white/10">
              <p className="text-xs text-slate-400 uppercase font-bold tracking-widest mb-1">Total Quote</p>
              <p className="text-4xl font-black text-emerald-400">R{total.toLocaleString()}</p>
            </div>

            <button className="w-full mt-8 bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-2xl font-bold transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2">
              <FileText className="w-5 h-5" />
              Generate PDF Quote
            </button>
            
            <p className="mt-6 text-[10px] text-slate-500 leading-relaxed text-center italic">
              * Values for P, S, and M are listed as "Possible additional costs" unless explicitly requested.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const PartnerPortalView = () => {
  const stats = [
    { label: 'Total Moves', value: '124', icon: Truck, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'Completion Rate', value: '98.2%', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { label: 'Partner Rating', value: '4.9/5', icon: ShieldCheck, color: 'text-amber-500', bg: 'bg-amber-50' },
    { label: 'Total Earnings', value: 'R452,000', icon: DollarSign, color: 'text-purple-500', bg: 'bg-purple-50' },
  ];

  const recentActivity = [
    { id: 1, type: 'Move Completed', date: '2 hours ago', details: 'Residential Move - Sandton to Midrand' },
    { id: 2, type: 'New Quote Request', date: '5 hours ago', details: 'Office Relocation - 8 Ton Truck' },
    { id: 3, type: 'Payment Received', date: 'Yesterday', details: 'Invoice #TF-9021' },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-3xl font-bold text-slate-900">Partner Portal</h2>
        <p className="text-slate-500">Welcome back, Keys Movers. Here is your performance overview.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4", stat.bg)}>
              <stat.icon className={cn("w-6 h-6", stat.color)} />
            </div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">{stat.label}</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="text-xl font-bold text-slate-900 mb-6">Recent Activity</h3>
          <div className="space-y-6">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex gap-4">
                <div className="w-2 h-2 rounded-full bg-emerald-500 mt-2 shrink-0" />
                <div>
                  <p className="font-bold text-slate-900">{activity.type}</p>
                  <p className="text-sm text-slate-500">{activity.details}</p>
                  <p className="text-xs text-slate-400 mt-1">{activity.date}</p>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full mt-8 py-3 text-sm font-bold text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors">
            View All Activity
          </button>
        </div>

        <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl">
          <h3 className="text-xl font-bold mb-6">Partner Support</h3>
          <p className="text-slate-400 text-sm leading-relaxed mb-8">
            Need help with a move or have questions about your statistics? Our partner success team is available 24/7.
          </p>
          <div className="space-y-4">
            <button className="w-full bg-white/10 hover:bg-white/20 py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Chat with Support
            </button>
            <button className="w-full bg-emerald-500 hover:bg-emerald-600 py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2">
              <FileText className="w-5 h-5" />
              Partner Documentation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const LoginView = ({ onLogin }: { onLogin: (role: 'admin' | 'owner' | 'partner') => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Simulate login
    setTimeout(() => {
      if (email === 'admin@truckflow.com' && password === 'admin123') {
        onLogin('admin');
      } else if (email === 'owner@truckflow.com' && password === 'owner123') {
        onLogin('owner');
      } else if (email === 'partner@truckflow.com' && password === 'partner123') {
        onLogin('partner');
      } else if (email === 'keys@truckflow.com' && password === 'keys123') {
        onLogin('partner');
      } else {
        setError('Invalid email or password. Try keys@truckflow.com / keys123');
        setIsLoading(false);
      }
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl relative z-10"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="bg-emerald-500 p-4 rounded-2xl shadow-lg shadow-emerald-500/20 mb-4">
            <Truck className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">TruckFlow OS</h1>
          <p className="text-slate-400 mt-2">Sign in to manage your fleet</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-300 ml-1">Email Address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Users className="h-5 w-5 text-slate-500" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                placeholder="name@company.com"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-300 ml-1">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <ShieldCheck className="h-5 w-5 text-slate-500" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-slate-400 cursor-pointer">
              <input type="checkbox" className="rounded border-white/10 bg-white/5 text-emerald-500 focus:ring-emerald-500" />
              Remember me
            </label>
            <a href="#" className="text-emerald-500 font-bold hover:underline">Forgot password?</a>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                Sign In
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-8 border-t border-white/5 text-center">
          <p className="text-slate-400 text-sm">
            Don't have an account? <a href="#" className="text-emerald-500 font-bold hover:underline">Contact Sales</a>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [activeView, setView] = useState<View>('dashboard');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<'admin' | 'owner' | 'partner' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleLogin = (role: 'admin' | 'owner' | 'partner') => {
    setIsLoggedIn(true);
    setUserRole(role);
    if (role === 'admin') setView('dashboard');
    else if (role === 'owner') setView('owner-portal');
    else if (role === 'partner') setView('partner-portal');
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserRole(null);
    setView('login');
  };

  if (!isLoggedIn) {
    return <LoginView onLogin={handleLogin} />;
  }

  const renderView = () => {
    switch (activeView) {
      case 'dashboard': return <Dashboard searchQuery={searchQuery} />;
      case 'fleet': return <FleetManagement searchQuery={searchQuery} />;
      case 'drivers': return <DriversManagementView searchQuery={searchQuery} />;
      case 'jobs': return <JobScheduling />;
      case 'ai': return <DispatchAI />;
      case 'driver': return <DriverApp />;
      case 'invoices': return <InvoicesView />;
      case 'compliance': return <ComplianceView />;
      case 'owner-portal': return <OwnerPortalView />;
      case 'partner-portal': return <PartnerPortalView />;
      case 'enroll-truck': return <EnrollTruckView setView={setView} />;
      case 'proposal': return <ProposalView />;
      case 'outreach': return <PartnerOutreachView />;
      case 'partner-quotes': return <PartnerQuotesView />;
      default: return <Dashboard searchQuery={searchQuery} />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      <Sidebar activeView={activeView} setView={setView} onLogout={handleLogout} userRole={userRole} />
      
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4">
            <button className="lg:hidden p-2 hover:bg-slate-100 rounded-lg">
              <Menu className="w-5 h-5" />
            </button>
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search jobs, trucks, or customers..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-emerald-500 rounded-xl text-sm w-80 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="relative p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <Bell className="w-5 h-5 text-slate-600" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
            </button>
            <div className="h-8 w-px bg-slate-200 mx-2" />
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-900">
                  {userRole === 'admin' ? 'Admin Panel' : userRole === 'owner' ? 'Owner Portal' : 'Partner Portal'}
                </p>
                <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">System Online</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200">
                <Users className="w-5 h-5 text-slate-600" />
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
