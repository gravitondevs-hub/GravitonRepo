import { Truck, CheckCircle2, ShieldCheck, DollarSign, Calendar, MapPin, Clock, Users, FileText, MessageSquare, Navigation, Shield, Package } from 'lucide-react';

export const REVENUE_DATA = [
  { name: 'Mon', revenue: 45000, jobs: 12 },
  { name: 'Tue', revenue: 52000, jobs: 15 },
  { name: 'Wed', revenue: 48000, jobs: 14 },
  { name: 'Thu', revenue: 61000, jobs: 18 },
  { name: 'Fri', revenue: 55000, jobs: 16 },
  { name: 'Sat', revenue: 32000, jobs: 8 },
  { name: 'Sun', revenue: 28000, jobs: 6 },
];

export const FLEET_STATUS_DATA = [
  { name: 'Active', value: 45 },
  { name: 'Maintenance', value: 5 },
  { name: 'Idle', value: 10 },
];

export const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

export const RECENT_JOBS = [
  { id: 'JB-1024', customer: 'Global Logistics', route: 'Cape Town → Johannesburg', status: 'In Transit', type: 'Long Haul', amount: 'R12,400' },
  { id: 'JB-1025', customer: 'Fresh Foods Co', route: 'Durban → Pretoria', status: 'Scheduled', type: 'Refrigerated', amount: 'R8,200' },
  { id: 'JB-1026', customer: 'Retail Giant', route: 'Port Elizabeth → East London', status: 'Completed', type: 'Distribution', amount: 'R4,500' },
  { id: 'JB-1027', customer: 'Mining Solutions', route: 'Rustenburg → Richards Bay', status: 'Pending', type: 'Heavy Load', amount: 'R24,000' },
];

export const DRIVERS_DATA = [
  { id: 1, name: 'John Doe', status: 'Active', rating: 4.8, trips: 156, license: 'Code 14', phone: '+27 82 123 4567' },
  { id: 2, name: 'Sarah Smith', status: 'On Leave', rating: 4.9, trips: 203, license: 'Code 14', phone: '+27 83 234 5678' },
  { id: 3, name: 'Mike Johnson', status: 'Active', rating: 4.7, trips: 89, license: 'Code 10', phone: '+27 84 345 6789' },
  { id: 4, name: 'David Wilson', status: 'Resting', rating: 4.6, trips: 112, license: 'Code 14', phone: '+27 81 456 7890' },
];

export const FLEET_DATA = [
  { id: 'TRK-001', model: 'Volvo FH16', type: '8-Ton', status: 'Active', fuel: '75%', mileage: '124,500 km', nextService: '128,000 km' },
  { id: 'TRK-002', model: 'Scania R500', type: '12-Ton', status: 'Maintenance', fuel: '20%', mileage: '245,000 km', nextService: '246,000 km' },
  { id: 'TRK-003', model: 'Mercedes Actros', type: '14-Ton', status: 'Active', fuel: '90%', mileage: '89,000 km', nextService: '100,000 km' },
  { id: 'TRK-004', model: 'MAN TGX', type: '8-Ton', status: 'Idle', fuel: '45%', mileage: '156,000 km', nextService: '160,000 km' },
];
