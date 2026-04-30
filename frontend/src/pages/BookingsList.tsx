import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { 
  Calendar, 
  DollarSign,
  ChevronRight,
  ArrowLeft,
  Trash2,
  CheckSquare,
  Square,
  X,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Booking } from '../types';
import { bookingsApi } from '../utils/api';
import { format } from 'date-fns';

export default function BookingsList() {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const statusFilter = searchParams.get('status');
  
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [longPressTimer, setLongPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!token) return;
      
      try {
        const response = await bookingsApi.getMyBookingsAsClient(token);
        if ((response as any).success) {
          let bookingsList = (response as any).data || [];
          
          // Apply status filter if present
          if (statusFilter === 'upcoming') {
            bookingsList = bookingsList.filter((b: Booking) => 
              ['CONFIRMED', 'DEPOSIT_PAID', 'PENDING_DEPOSIT'].includes(b.status)
            );
          } else if (statusFilter === 'completed') {
            bookingsList = bookingsList.filter((b: Booking) => b.status === 'COMPLETED');
          } else if (statusFilter) {
            bookingsList = bookingsList.filter((b: Booking) => b.status === statusFilter);
          }
          
          setBookings(bookingsList);
        }
      } catch (err) {
        console.error('Failed to load bookings:', err);
        setBookings([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [token, statusFilter]);

  const getPageTitle = () => {
    switch (statusFilter) {
      case 'upcoming':
        return 'Upcoming Events';
      case 'completed':
        return 'Completed Events';
      case 'PENDING_DEPOSIT':
        return 'Pending Deposit';
      case 'CONFIRMED':
        return 'Confirmed Bookings';
      default:
        return 'All Bookings';
    }
  };

  // Long press handlers
  const handleMouseDown = useCallback((id: string) => {
    const timer = setTimeout(() => {
      setSelectionMode(true);
      setSelectedIds(new Set([id]));
    }, 500);
    setLongPressTimer(timer);
  }, []);

  const handleMouseUp = useCallback(() => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  }, [longPressTimer]);

  const handleMouseLeave = useCallback(() => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  }, [longPressTimer]);

  const handleTouchStart = useCallback((id: string) => {
    const timer = setTimeout(() => {
      setSelectionMode(true);
      setSelectedIds(new Set([id]));
    }, 500);
    setLongPressTimer(timer);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  }, [longPressTimer]);

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const canDelete = (booking: Booking) => {
    return booking.status !== 'COMPLETED' && booking.status !== 'IN_PROGRESS';
  };

  const selectAll = () => {
    const selectableIds = bookings
      .filter(b => canDelete(b))
      .map(b => b.id);
    setSelectedIds(new Set(selectableIds));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const cancelSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleDelete = async () => {
    if (!token || selectedIds.size === 0) return;
    
    setIsDeleting(true);
    try {
      const deletePromises = Array.from(selectedIds).map(async (id) => {
        try {
          const response = await fetch(`/api/v1/bookings/${id}/cancel`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ reason: 'Cancelled by user' }),
          });
          return { id, success: response.ok };
        } catch {
          return { id, success: false };
        }
      });

      const results = await Promise.all(deletePromises);
      const successfulDeletes = results.filter(r => r.success).map(r => r.id);
      
      // Update status to cancelled for successful ones
      setBookings(prev => prev.map(b => 
        successfulDeletes.includes(b.id) ? { ...b, status: 'CANCELLED' as any } : b
      ));
      setSelectedIds(new Set());
      setSelectionMode(false);
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('Failed to cancel bookings:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const selectedDeletableCount = Array.from(selectedIds).filter(id => {
    const booking = bookings.find(b => b.id === id);
    return booking && canDelete(booking);
  }).length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return 'bg-green-100 text-green-700';
      case 'DEPOSIT_PAID':
        return 'bg-blue-100 text-blue-700';
      case 'PENDING_DEPOSIT':
        return 'bg-amber-100 text-amber-700';
      case 'COMPLETED':
        return 'bg-purple-100 text-purple-700';
      case 'CANCELLED':
        return 'bg-red-100 text-red-700';
      case 'IN_PROGRESS':
        return 'bg-cyan-100 text-cyan-700';
      default:
        return 'bg-stone-100 text-stone-600';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="py-8">
      <div className="section-padding max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link 
            to="/dashboard" 
            className="flex items-center gap-2 text-stone-600 hover:text-stone-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </Link>
          <div className="flex items-center justify-between">
            <h1 className="font-display text-3xl font-bold text-stone-900">
              {getPageTitle()}
            </h1>
            <span className="text-stone-500">{bookings.length} bookings</span>
          </div>
        </div>

        {/* Selection Mode Bar */}
        {selectionMode && (
          <div className="bg-brand-50 border border-brand-200 rounded-xl p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={cancelSelection}
                className="p-2 hover:bg-brand-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-brand-700" />
              </button>
              <span className="font-medium text-brand-900">
                {selectedIds.size} selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={selectedIds.size === bookings.filter(b => canDelete(b)).length ? deselectAll : selectAll}
                className="btn-secondary text-sm py-2"
              >
                {selectedIds.size === bookings.filter(b => canDelete(b)).length ? 'Deselect All' : 'Select All'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={selectedDeletableCount === 0}
                className="btn-primary bg-red-500 hover:bg-red-600 text-sm py-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Cancel ({selectedDeletableCount})
              </button>
            </div>
          </div>
        )}

        {/* Help text */}
        {!selectionMode && bookings.length > 0 && (
          <p className="text-sm text-stone-500 mb-4">
            💡 Tip: Press and hold on an item to enable selection mode
          </p>
        )}

        {/* List */}
        {bookings.length === 0 ? (
          <div className="card p-8 text-center">
            <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-stone-400" />
            </div>
            <h3 className="font-semibold text-stone-900 mb-2">No bookings found</h3>
            <p className="text-stone-600 mb-4">
              {statusFilter 
                ? `You don't have any ${statusFilter.toLowerCase().replace('_', ' ')} bookings.`
                : "You don't have any bookings yet."}
            </p>
            <Link to="/create-request" className="btn-primary">
              Create Event Request
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <div
                key={booking.id}
                className={`card p-5 transition-all cursor-pointer ${
                  selectedIds.has(booking.id) ? 'ring-2 ring-brand-500 bg-brand-50' : 'card-hover'
                }`}
                onMouseDown={() => !selectionMode && handleMouseDown(booking.id)}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onTouchStart={() => !selectionMode && handleTouchStart(booking.id)}
                onTouchEnd={handleTouchEnd}
                onClick={() => {
                  if (selectionMode) {
                    if (canDelete(booking)) {
                      toggleSelection(booking.id);
                    }
                  } else {
                    // Navigate to detail page when not in selection mode
                    window.location.href = `/bookings/${booking.id}`;
                  }
                }}
              >
                <div className="flex items-center gap-4">
                  {/* Checkbox in selection mode */}
                  {selectionMode && (
                    <div className="flex-shrink-0">
                      {canDelete(booking) ? (
                        selectedIds.has(booking.id) ? (
                          <CheckSquare className="w-6 h-6 text-brand-500" />
                        ) : (
                          <Square className="w-6 h-6 text-stone-400" />
                        )
                      ) : (
                        <div className="w-6 h-6 flex items-center justify-center" title="Cannot cancel completed events">
                          <AlertCircle className="w-5 h-5 text-stone-300" />
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    booking.status === 'COMPLETED' ? 'bg-purple-100' : 'bg-green-100'
                  }`}>
                    <CheckCircle className={`w-6 h-6 ${
                      booking.status === 'COMPLETED' ? 'text-purple-600' : 'text-green-600'
                    }`} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-stone-900 truncate">
                      {(booking as any).eventRequest?.title || 'Event Booking'}
                    </h3>
                    <p className="text-sm text-stone-500 mt-0.5">
                      {(booking as any).provider?.businessName || 'Provider'}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-stone-500 mt-2">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {format(new Date((booking as any).eventDate ?? (booking as any).eventRequest?.eventDate ?? ''), 'MMM d, yyyy')}
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        ${booking.totalAmount?.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                      {booking.status.replace('_', ' ')}
                    </span>
                    {!selectionMode && (
                      <Link 
                        to={`/bookings/${booking.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
                      >
                        <ChevronRight className="w-5 h-5 text-stone-400" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Cancel Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full">
              <h3 className="font-display text-xl font-bold text-stone-900 mb-2">
                Cancel Bookings?
              </h3>
              <p className="text-stone-600 mb-6">
                Are you sure you want to cancel {selectedDeletableCount} booking{selectedDeletableCount !== 1 ? 's' : ''}? 
                This may affect your refund eligibility.
              </p>
              {selectedIds.size !== selectedDeletableCount && (
                <p className="text-amber-600 text-sm mb-4">
                  Note: {selectedIds.size - selectedDeletableCount} completed event(s) cannot be cancelled.
                </p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="btn-secondary flex-1"
                  disabled={isDeleting}
                >
                  Keep Bookings
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="btn-primary bg-red-500 hover:bg-red-600 flex-1"
                >
                  {isDeleting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Cancelling...
                    </span>
                  ) : (
                    'Cancel Bookings'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
