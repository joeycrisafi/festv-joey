import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft,
  DollarSign,
  Calendar,
  TrendingUp,
  TrendingDown,
  Download,
  ChevronRight,
  CheckCircle,
  Clock,
  CreditCard
} from 'lucide-react';

// Mock earnings data
const mockEarnings = {
  totalEarnings: 45680,
  thisMonth: 8450,
  lastMonth: 7200,
  pending: 3200,
};

const mockTransactions = [
  {
    id: '1',
    type: 'payment',
    description: 'Smith Wedding - Final Payment',
    amount: 4875,
    status: 'completed',
    date: '2025-01-20',
    bookingId: '1',
    clientName: 'John Smith',
  },
  {
    id: '2',
    type: 'payment',
    description: 'Tech Corp Gala - Deposit',
    amount: 3000,
    status: 'completed',
    date: '2025-01-18',
    bookingId: '2',
    clientName: 'TechCorp Inc.',
  },
  {
    id: '3',
    type: 'pending',
    description: 'Johnson Birthday - Balance Due',
    amount: 1800,
    status: 'pending',
    date: '2025-01-25',
    bookingId: '3',
    clientName: 'Sarah Johnson',
  },
  {
    id: '4',
    type: 'payment',
    description: 'Corporate Lunch - Full Payment',
    amount: 2200,
    status: 'completed',
    date: '2025-01-15',
    bookingId: '4',
    clientName: 'Acme Corp',
  },
  {
    id: '5',
    type: 'payment',
    description: 'Anniversary Dinner - Deposit',
    amount: 800,
    status: 'completed',
    date: '2025-01-12',
    bookingId: '5',
    clientName: 'Michael Brown',
  },
  {
    id: '6',
    type: 'pending',
    description: 'Wedding Reception - Deposit',
    amount: 2500,
    status: 'pending',
    date: '2025-01-28',
    bookingId: '6',
    clientName: 'Emily Davis',
  },
  {
    id: '7',
    type: 'refund',
    description: 'Cancelled Event - Partial Refund',
    amount: -500,
    status: 'completed',
    date: '2025-01-10',
    bookingId: '7',
    clientName: 'James Wilson',
  },
];

const mockMonthlyData = [
  { month: 'Aug', amount: 5200 },
  { month: 'Sep', amount: 6800 },
  { month: 'Oct', amount: 7100 },
  { month: 'Nov', amount: 6400 },
  { month: 'Dec', amount: 7200 },
  { month: 'Jan', amount: 8450 },
];

export default function ProviderEarnings() {
  const [filter, setFilter] = useState<'all' | 'completed' | 'pending'>('all');
  const [dateRange, setDateRange] = useState('this-month');

  const filteredTransactions = mockTransactions.filter(t => {
    if (filter === 'all') return true;
    return t.status === filter;
  });

  const percentChange = ((mockEarnings.thisMonth - mockEarnings.lastMonth) / mockEarnings.lastMonth) * 100;

  return (
    <div className="py-8">
      <div className="section-padding">
        {/* Header */}
        <div className="mb-8">
          <Link 
            to="/provider/dashboard" 
            className="flex items-center gap-2 text-stone-600 hover:text-stone-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-3xl font-bold text-stone-900">
                Earnings
              </h1>
              <p className="text-stone-600 mt-1">
                Track your income and payment history
              </p>
            </div>
            <button className="btn-secondary">
              <Download className="w-5 h-5 mr-2" />
              Export
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-sm text-stone-500">Total Earnings</span>
            </div>
            <p className="text-2xl font-bold text-stone-900">
              ${mockEarnings.totalEarnings.toLocaleString()}
            </p>
          </div>

          <div className="card p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-sm text-stone-500">This Month</span>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold text-stone-900">
                ${mockEarnings.thisMonth.toLocaleString()}
              </p>
              <span className={`flex items-center text-sm ${percentChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {percentChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {Math.abs(percentChange).toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <span className="text-sm text-stone-500">Pending</span>
            </div>
            <p className="text-2xl font-bold text-stone-900">
              ${mockEarnings.pending.toLocaleString()}
            </p>
          </div>

          <div className="card p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-purple-600" />
              </div>
              <span className="text-sm text-stone-500">Last Month</span>
            </div>
            <p className="text-2xl font-bold text-stone-900">
              ${mockEarnings.lastMonth.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Chart Section */}
        <div className="card p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-lg font-semibold text-stone-900">
              Monthly Earnings
            </h2>
            <select 
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="input-field w-auto text-sm"
            >
              <option value="this-month">Last 6 Months</option>
              <option value="this-year">This Year</option>
              <option value="all-time">All Time</option>
            </select>
          </div>
          
          {/* Simple bar chart */}
          <div className="flex items-end justify-between gap-2 h-48">
            {mockMonthlyData.map((data, index) => {
              const maxAmount = Math.max(...mockMonthlyData.map(d => d.amount));
              const height = (data.amount / maxAmount) * 100;
              const isCurrentMonth = index === mockMonthlyData.length - 1;
              
              return (
                <div key={data.month} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-sm font-medium text-stone-900">
                    ${(data.amount / 1000).toFixed(1)}k
                  </span>
                  <div 
                    className={`w-full rounded-t-lg transition-all ${
                      isCurrentMonth ? 'bg-brand-500' : 'bg-stone-200'
                    }`}
                    style={{ height: `${height}%` }}
                  />
                  <span className="text-xs text-stone-500">{data.month}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Transactions List */}
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-stone-200">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-stone-900">
                Transaction History
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filter === 'all' 
                      ? 'bg-brand-100 text-brand-700' 
                      : 'text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilter('completed')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filter === 'completed' 
                      ? 'bg-green-100 text-green-700' 
                      : 'text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  Completed
                </button>
                <button
                  onClick={() => setFilter('pending')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filter === 'pending' 
                      ? 'bg-amber-100 text-amber-700' 
                      : 'text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  Pending
                </button>
              </div>
            </div>
          </div>

          <div className="divide-y divide-stone-100">
            {filteredTransactions.map((transaction) => (
              <Link
                key={transaction.id}
                to={`/bookings/${transaction.bookingId}`}
                className="flex items-center gap-4 p-4 hover:bg-stone-50 transition-colors"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  transaction.status === 'completed' 
                    ? 'bg-green-100' 
                    : transaction.status === 'pending'
                    ? 'bg-amber-100'
                    : 'bg-red-100'
                }`}>
                  {transaction.status === 'completed' ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : transaction.status === 'pending' ? (
                    <Clock className="w-5 h-5 text-amber-600" />
                  ) : (
                    <DollarSign className="w-5 h-5 text-red-600" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-stone-900 truncate">
                    {transaction.description}
                  </p>
                  <p className="text-sm text-stone-500">
                    {transaction.clientName} • {new Date(transaction.date).toLocaleDateString()}
                  </p>
                </div>

                <div className="text-right">
                  <p className={`font-semibold ${
                    transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {transaction.amount >= 0 ? '+' : ''}${Math.abs(transaction.amount).toLocaleString()}
                  </p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    transaction.status === 'completed'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {transaction.status}
                  </span>
                </div>

                <ChevronRight className="w-5 h-5 text-stone-400" />
              </Link>
            ))}
          </div>

          {filteredTransactions.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-stone-500">No transactions found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
