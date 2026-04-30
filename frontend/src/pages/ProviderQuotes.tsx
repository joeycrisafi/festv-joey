import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft,
  Send,
  Calendar,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  ChevronRight,
  Edit,
  Trash2
} from 'lucide-react';

type QuoteStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired';

interface Quote {
  id: string;
  eventTitle: string;
  clientName: string;
  clientEmail: string;
  eventDate: string;
  guestCount: number;
  totalAmount: number;
  status: QuoteStatus;
  sentAt?: string;
  viewedAt?: string;
  respondedAt?: string;
  validUntil: string;
  message?: string;
}

const mockQuotes: Quote[] = [
  {
    id: '1',
    eventTitle: 'Wedding Reception Catering',
    clientName: 'John Smith',
    clientEmail: 'john@example.com',
    eventDate: '2025-03-15',
    guestCount: 150,
    totalAmount: 6750,
    status: 'sent',
    sentAt: '2025-01-20',
    validUntil: '2025-02-03',
    message: 'We would be delighted to cater your wedding reception...',
  },
  {
    id: '2',
    eventTitle: 'Corporate Annual Dinner',
    clientName: 'TechCorp Inc.',
    clientEmail: 'events@techcorp.com',
    eventDate: '2025-02-20',
    guestCount: 80,
    totalAmount: 4000,
    status: 'viewed',
    sentAt: '2025-01-18',
    viewedAt: '2025-01-19',
    validUntil: '2025-02-01',
  },
  {
    id: '3',
    eventTitle: '50th Birthday Celebration',
    clientName: 'Sarah Johnson',
    clientEmail: 'sarah@example.com',
    eventDate: '2025-02-10',
    guestCount: 50,
    totalAmount: 2250,
    status: 'accepted',
    sentAt: '2025-01-15',
    viewedAt: '2025-01-15',
    respondedAt: '2025-01-16',
    validUntil: '2025-01-29',
  },
  {
    id: '4',
    eventTitle: 'Charity Gala Dinner',
    clientName: 'Helping Hands Foundation',
    clientEmail: 'events@helpinghands.org',
    eventDate: '2025-04-05',
    guestCount: 200,
    totalAmount: 9000,
    status: 'draft',
    validUntil: '2025-02-15',
  },
  {
    id: '5',
    eventTitle: 'Anniversary Dinner',
    clientName: 'Michael Brown',
    clientEmail: 'mike@example.com',
    eventDate: '2025-02-14',
    guestCount: 30,
    totalAmount: 1500,
    status: 'rejected',
    sentAt: '2025-01-10',
    viewedAt: '2025-01-11',
    respondedAt: '2025-01-12',
    validUntil: '2025-01-24',
  },
  {
    id: '6',
    eventTitle: 'Baby Shower Brunch',
    clientName: 'Emily Davis',
    clientEmail: 'emily@example.com',
    eventDate: '2025-03-01',
    guestCount: 25,
    totalAmount: 1125,
    status: 'expired',
    sentAt: '2024-12-20',
    validUntil: '2025-01-03',
  },
];

const statusConfig: Record<QuoteStatus, { label: string; color: string; bgColor: string }> = {
  draft: { label: 'Draft', color: 'text-stone-600', bgColor: 'bg-stone-100' },
  sent: { label: 'Sent', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  viewed: { label: 'Viewed', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  accepted: { label: 'Accepted', color: 'text-green-600', bgColor: 'bg-green-100' },
  rejected: { label: 'Rejected', color: 'text-red-600', bgColor: 'bg-red-100' },
  expired: { label: 'Expired', color: 'text-amber-600', bgColor: 'bg-amber-100' },
};

export default function ProviderQuotes() {
  const [filter, setFilter] = useState<QuoteStatus | 'all'>('all');
  const [selectedQuotes, setSelectedQuotes] = useState<string[]>([]);

  const filteredQuotes = mockQuotes.filter(q => {
    if (filter === 'all') return true;
    return q.status === filter;
  });

  const pendingCount = mockQuotes.filter(q => ['sent', 'viewed'].includes(q.status)).length;
  const acceptedCount = mockQuotes.filter(q => q.status === 'accepted').length;

  const toggleSelectQuote = (id: string) => {
    setSelectedQuotes(prev => 
      prev.includes(id) ? prev.filter(qId => qId !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedQuotes.length === filteredQuotes.length) {
      setSelectedQuotes([]);
    } else {
      setSelectedQuotes(filteredQuotes.map(q => q.id));
    }
  };

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
                Quotes
              </h1>
              <p className="text-stone-600 mt-1">
                Manage your quotes and proposals
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="card p-4">
            <p className="text-sm text-stone-500 mb-1">Total Quotes</p>
            <p className="text-2xl font-bold text-stone-900">{mockQuotes.length}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-stone-500 mb-1">Pending Response</p>
            <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-stone-500 mb-1">Accepted</p>
            <p className="text-2xl font-bold text-green-600">{acceptedCount}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-stone-500 mb-1">Conversion Rate</p>
            <p className="text-2xl font-bold text-brand-600">
              {mockQuotes.length > 0 ? ((acceptedCount / mockQuotes.length) * 100).toFixed(0) : 0}%
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'all' 
                ? 'bg-brand-100 text-brand-700' 
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            All ({mockQuotes.length})
          </button>
          {Object.entries(statusConfig).map(([status, config]) => {
            const count = mockQuotes.filter(q => q.status === status).length;
            return (
              <button
                key={status}
                onClick={() => setFilter(status as QuoteStatus)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === status 
                    ? `${config.bgColor} ${config.color}` 
                    : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                {config.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Bulk Actions */}
        {selectedQuotes.length > 0 && (
          <div className="bg-brand-50 border border-brand-200 rounded-xl p-4 mb-6 flex items-center justify-between">
            <span className="text-brand-700 font-medium">
              {selectedQuotes.length} quote{selectedQuotes.length > 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <button className="btn-secondary text-sm py-2">
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </button>
            </div>
          </div>
        )}

        {/* Quotes List */}
        <div className="card overflow-hidden">
          {/* Table Header */}
          <div className="hidden md:grid grid-cols-12 gap-4 p-4 bg-stone-50 border-b border-stone-200 text-sm font-medium text-stone-600">
            <div className="col-span-1">
              <input
                type="checkbox"
                checked={selectedQuotes.length === filteredQuotes.length && filteredQuotes.length > 0}
                onChange={toggleSelectAll}
                className="rounded border-stone-300"
              />
            </div>
            <div className="col-span-4">Event</div>
            <div className="col-span-2">Client</div>
            <div className="col-span-2">Amount</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-1"></div>
          </div>

          <div className="divide-y divide-stone-100">
            {filteredQuotes.map((quote) => (
              <div
                key={quote.id}
                className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 hover:bg-stone-50 transition-colors items-center"
              >
                <div className="hidden md:block col-span-1">
                  <input
                    type="checkbox"
                    checked={selectedQuotes.includes(quote.id)}
                    onChange={() => toggleSelectQuote(quote.id)}
                    className="rounded border-stone-300"
                  />
                </div>

                <div className="col-span-4">
                  <Link to={`/quotes/${quote.id}`} className="block">
                    <p className="font-medium text-stone-900 hover:text-brand-600">
                      {quote.eventTitle}
                    </p>
                    <div className="flex items-center gap-3 text-sm text-stone-500 mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(quote.eventDate).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {quote.guestCount} guests
                      </span>
                    </div>
                  </Link>
                </div>

                <div className="col-span-2">
                  <p className="text-stone-900">{quote.clientName}</p>
                  <p className="text-sm text-stone-500 truncate">{quote.clientEmail}</p>
                </div>

                <div className="col-span-2">
                  <p className="font-semibold text-stone-900">
                    ${quote.totalAmount.toLocaleString()}
                  </p>
                  <p className="text-xs text-stone-500">
                    Valid until {new Date(quote.validUntil).toLocaleDateString()}
                  </p>
                </div>

                <div className="col-span-2">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig[quote.status].bgColor} ${statusConfig[quote.status].color}`}>
                    {quote.status === 'accepted' && <CheckCircle className="w-3.5 h-3.5" />}
                    {quote.status === 'rejected' && <XCircle className="w-3.5 h-3.5" />}
                    {quote.status === 'viewed' && <Eye className="w-3.5 h-3.5" />}
                    {quote.status === 'sent' && <Send className="w-3.5 h-3.5" />}
                    {quote.status === 'expired' && <Clock className="w-3.5 h-3.5" />}
                    {statusConfig[quote.status].label}
                  </span>
                  {quote.viewedAt && quote.status !== 'accepted' && quote.status !== 'rejected' && (
                    <p className="text-xs text-stone-500 mt-1">
                      Viewed {new Date(quote.viewedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>

                <div className="col-span-1 flex justify-end gap-2">
                  {quote.status === 'draft' && (
                    <button className="p-2 hover:bg-stone-100 rounded-lg" title="Edit">
                      <Edit className="w-4 h-4 text-stone-500" />
                    </button>
                  )}
                  <Link 
                    to={`/quotes/${quote.id}`}
                    className="p-2 hover:bg-stone-100 rounded-lg"
                    title="View"
                  >
                    <ChevronRight className="w-4 h-4 text-stone-500" />
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {filteredQuotes.length === 0 && (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Send className="w-8 h-8 text-stone-400" />
              </div>
              <h3 className="font-semibold text-stone-900 mb-2">No quotes found</h3>
              <p className="text-stone-600">
                {filter === 'all' 
                  ? "You haven't sent any quotes yet." 
                  : `No ${filter} quotes.`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
