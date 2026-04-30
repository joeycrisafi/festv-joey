import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft,
  Calendar,
  Users,
  Clock,
  MapPin,
  ChevronRight,
  Phone,
  Mail,
  MessageSquare
} from 'lucide-react';

type BookingStatus = 'pending_deposit' | 'deposit_paid' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';

interface Booking {
  id: string;
  eventTitle: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  eventDate: string;
  eventStartTime: string;
  eventEndTime: string;
  guestCount: number;
  totalAmount: number;
  depositAmount: number;
  depositPaid: boolean;
  balancePaid: boolean;
  status: BookingStatus;
  venue: string;
  venueCity: string;
  venueState: string;
  eventType: string;
}

const mockBookings: Booking[] = [
  {
    id: '1',
    eventTitle: 'Smith Wedding Reception',
    clientName: 'John Smith',
    clientEmail: 'john@example.com',
    clientPhone: '(555) 123-4567',
    eventDate: '2025-02-01',
    eventStartTime: '18:00',
    eventEndTime: '23:00',
    guestCount: 150,
    totalAmount: 6750,
    depositAmount: 1687,
    depositPaid: true,
    balancePaid: false,
    status: 'confirmed',
    venue: 'The Grand Ballroom',
    venueCity: 'San Francisco',
    venueState: 'CA',
    eventType: 'WEDDING',
  },
  {
    id: '2',
    eventTitle: 'Tech Corp Annual Gala',
    clientName: 'TechCorp Inc.',
    clientEmail: 'events@techcorp.com',
    clientPhone: '(555) 987-6543',
    eventDate: '2025-02-15',
    eventStartTime: '19:00',
    eventEndTime: '22:00',
    guestCount: 200,
    totalAmount: 12000,
    depositAmount: 3000,
    depositPaid: true,
    balancePaid: false,
    status: 'deposit_paid',
    venue: 'Tech Convention Center',
    venueCity: 'Palo Alto',
    venueState: 'CA',
    eventType: 'CORPORATE',
  },
  {
    id: '3',
    eventTitle: 'Johnson Birthday Celebration',
    clientName: 'Sarah Johnson',
    clientEmail: 'sarah@example.com',
    clientPhone: '(555) 456-7890',
    eventDate: '2025-01-25',
    eventStartTime: '14:00',
    eventEndTime: '18:00',
    guestCount: 50,
    totalAmount: 2250,
    depositAmount: 562,
    depositPaid: true,
    balancePaid: true,
    status: 'completed',
    venue: 'Johnson Residence',
    venueCity: 'Oakland',
    venueState: 'CA',
    eventType: 'BIRTHDAY',
  },
  {
    id: '4',
    eventTitle: 'Williams Anniversary Dinner',
    clientName: 'Robert Williams',
    clientEmail: 'robert@example.com',
    clientPhone: '(555) 234-5678',
    eventDate: '2025-02-14',
    eventStartTime: '19:00',
    eventEndTime: '22:00',
    guestCount: 30,
    totalAmount: 1800,
    depositAmount: 450,
    depositPaid: false,
    balancePaid: false,
    status: 'pending_deposit',
    venue: 'La Maison Restaurant',
    venueCity: 'Berkeley',
    venueState: 'CA',
    eventType: 'ANNIVERSARY',
  },
  {
    id: '5',
    eventTitle: 'Corporate Lunch Meeting',
    clientName: 'Acme Corp',
    clientEmail: 'admin@acme.com',
    clientPhone: '(555) 345-6789',
    eventDate: '2025-01-20',
    eventStartTime: '12:00',
    eventEndTime: '14:00',
    guestCount: 25,
    totalAmount: 875,
    depositAmount: 218,
    depositPaid: true,
    balancePaid: true,
    status: 'completed',
    venue: 'Acme Headquarters',
    venueCity: 'San Jose',
    venueState: 'CA',
    eventType: 'CORPORATE',
  },
  {
    id: '6',
    eventTitle: 'Cancelled Event',
    clientName: 'James Wilson',
    clientEmail: 'james@example.com',
    clientPhone: '(555) 567-8901',
    eventDate: '2025-02-28',
    eventStartTime: '18:00',
    eventEndTime: '21:00',
    guestCount: 40,
    totalAmount: 2000,
    depositAmount: 500,
    depositPaid: true,
    balancePaid: false,
    status: 'cancelled',
    venue: 'City Park Pavilion',
    venueCity: 'Fremont',
    venueState: 'CA',
    eventType: 'SOCIAL',
  },
];

const statusConfig: Record<BookingStatus, { label: string; color: string; bgColor: string }> = {
  pending_deposit: { label: 'Pending Deposit', color: 'text-amber-600', bgColor: 'bg-amber-100' },
  deposit_paid: { label: 'Deposit Paid', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  confirmed: { label: 'Confirmed', color: 'text-green-600', bgColor: 'bg-green-100' },
  in_progress: { label: 'In Progress', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  completed: { label: 'Completed', color: 'text-stone-600', bgColor: 'bg-stone-100' },
  cancelled: { label: 'Cancelled', color: 'text-red-600', bgColor: 'bg-red-100' },
};

export default function ProviderBookings() {
  const [filter, setFilter] = useState<BookingStatus | 'all' | 'active'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');

  const filteredBookings = mockBookings
    .filter(b => {
      if (filter === 'all') return true;
      if (filter === 'active') return ['pending_deposit', 'deposit_paid', 'confirmed', 'in_progress'].includes(b.status);
      return b.status === filter;
    })
    .sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime();
      }
      return b.totalAmount - a.totalAmount;
    });

  const activeCount = mockBookings.filter(b => 
    ['pending_deposit', 'deposit_paid', 'confirmed', 'in_progress'].includes(b.status)
  ).length;
  const completedCount = mockBookings.filter(b => b.status === 'completed').length;
  const totalRevenue = mockBookings
    .filter(b => b.status === 'completed')
    .reduce((sum, b) => sum + b.totalAmount, 0);

  // Group bookings by upcoming/past
  const today = new Date();
  const upcomingBookings = filteredBookings.filter(b => new Date(b.eventDate) >= today && b.status !== 'cancelled');
  const pastBookings = filteredBookings.filter(b => new Date(b.eventDate) < today || b.status === 'cancelled');

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
                Bookings
              </h1>
              <p className="text-stone-600 mt-1">
                Manage your event bookings
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="card p-4">
            <p className="text-sm text-stone-500 mb-1">Total Bookings</p>
            <p className="text-2xl font-bold text-stone-900">{mockBookings.length}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-stone-500 mb-1">Active</p>
            <p className="text-2xl font-bold text-blue-600">{activeCount}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-stone-500 mb-1">Completed</p>
            <p className="text-2xl font-bold text-green-600">{completedCount}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-stone-500 mb-1">Total Revenue</p>
            <p className="text-2xl font-bold text-brand-600">
              ${totalRevenue.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'all' 
                  ? 'bg-brand-100 text-brand-700' 
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'active' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'completed' 
                  ? 'bg-green-100 text-green-700' 
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              Completed
            </button>
            <button
              onClick={() => setFilter('cancelled')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'cancelled' 
                  ? 'bg-red-100 text-red-700' 
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              Cancelled
            </button>
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'date' | 'amount')}
            className="input-field w-auto text-sm"
          >
            <option value="date">Sort by Date</option>
            <option value="amount">Sort by Amount</option>
          </select>
        </div>

        {/* Upcoming Bookings */}
        {upcomingBookings.length > 0 && (
          <div className="mb-8">
            <h2 className="font-display text-lg font-semibold text-stone-900 mb-4">
              Upcoming Events ({upcomingBookings.length})
            </h2>
            <div className="space-y-4">
              {upcomingBookings.map((booking) => (
                <BookingCard key={booking.id} booking={booking} />
              ))}
            </div>
          </div>
        )}

        {/* Past Bookings */}
        {pastBookings.length > 0 && (
          <div>
            <h2 className="font-display text-lg font-semibold text-stone-500 mb-4">
              Past Events ({pastBookings.length})
            </h2>
            <div className="space-y-4 opacity-75">
              {pastBookings.map((booking) => (
                <BookingCard key={booking.id} booking={booking} />
              ))}
            </div>
          </div>
        )}

        {filteredBookings.length === 0 && (
          <div className="card p-12 text-center">
            <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-stone-400" />
            </div>
            <h3 className="font-semibold text-stone-900 mb-2">No bookings found</h3>
            <p className="text-stone-600">
              {filter === 'all' 
                ? "You don't have any bookings yet." 
                : `No ${filter.replace('_', ' ')} bookings.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function BookingCard({ booking }: { booking: Booking }) {
  const daysUntil = Math.ceil(
    (new Date(booking.eventDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );
  const isPast = daysUntil < 0;
  const isToday = daysUntil === 0;
  const isSoon = daysUntil > 0 && daysUntil <= 7;

  return (
    <Link
      to={`/bookings/${booking.id}`}
      className="card card-hover p-5 block"
    >
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        {/* Date Badge */}
        <div className={`w-20 h-20 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${
          booking.status === 'cancelled' 
            ? 'bg-red-100'
            : isPast 
            ? 'bg-stone-100' 
            : isToday
            ? 'bg-green-100'
            : isSoon 
            ? 'bg-amber-100' 
            : 'bg-brand-100'
        }`}>
          <span className={`text-sm font-medium ${
            booking.status === 'cancelled'
              ? 'text-red-600'
              : isPast 
              ? 'text-stone-500' 
              : isToday
              ? 'text-green-600'
              : isSoon 
              ? 'text-amber-600' 
              : 'text-brand-600'
          }`}>
            {new Date(booking.eventDate).toLocaleDateString('en-US', { month: 'short' })}
          </span>
          <span className={`text-2xl font-bold ${
            booking.status === 'cancelled'
              ? 'text-red-700'
              : isPast 
              ? 'text-stone-600' 
              : isToday
              ? 'text-green-700'
              : isSoon 
              ? 'text-amber-700' 
              : 'text-brand-700'
          }`}>
            {new Date(booking.eventDate).getDate()}
          </span>
        </div>

        {/* Event Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-stone-900 truncate">
                {booking.eventTitle}
              </h3>
              <p className="text-sm text-stone-500">
                {booking.clientName}
              </p>
            </div>
            <span className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${
              statusConfig[booking.status].bgColor
            } ${statusConfig[booking.status].color}`}>
              {statusConfig[booking.status].label}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-sm text-stone-600">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {booking.eventStartTime} - {booking.eventEndTime}
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {booking.guestCount} guests
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {booking.venueCity}, {booking.venueState}
            </span>
          </div>
        </div>

        {/* Amount & Actions */}
        <div className="flex items-center gap-4 lg:flex-col lg:items-end">
          <div className="text-right">
            <p className="text-xl font-bold text-stone-900">
              ${booking.totalAmount.toLocaleString()}
            </p>
            <p className="text-xs text-stone-500">
              {booking.depositPaid && booking.balancePaid 
                ? 'Fully Paid' 
                : booking.depositPaid 
                ? 'Deposit Paid'
                : 'Awaiting Deposit'}
            </p>
          </div>
          <div className="flex gap-2">
            <button 
              className="p-2 hover:bg-stone-100 rounded-lg"
              onClick={(e) => { e.preventDefault(); }}
              title="Call"
            >
              <Phone className="w-4 h-4 text-stone-500" />
            </button>
            <button 
              className="p-2 hover:bg-stone-100 rounded-lg"
              onClick={(e) => { e.preventDefault(); }}
              title="Email"
            >
              <Mail className="w-4 h-4 text-stone-500" />
            </button>
            <button 
              className="p-2 hover:bg-stone-100 rounded-lg"
              onClick={(e) => { e.preventDefault(); }}
              title="Message"
            >
              <MessageSquare className="w-4 h-4 text-stone-500" />
            </button>
          </div>
        </div>

        <ChevronRight className="w-5 h-5 text-stone-400 hidden lg:block" />
      </div>
    </Link>
  );
}
