import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { 
  Calendar, 
  Users, 
  DollarSign,
  ChevronRight,
  ArrowLeft,
  Trash2,
  CheckSquare,
  Square,
  X,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { EventRequest } from '../types';
import { eventRequestsApi } from '../utils/api';
import { format } from 'date-fns';

export default function EventRequestsList() {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const statusFilter = searchParams.get('status');
  
  const [eventRequests, setEventRequests] = useState<EventRequest[]>([]);
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
        const response = await eventRequestsApi.getMyRequestsAsClient(token);
        if ((response as any).success) {
          let requests = (response as any).data || [];
          
          // Apply status filter if present
          if (statusFilter) {
            requests = requests.filter((r: EventRequest) => r.status === statusFilter);
          }
          
          setEventRequests(requests);
        }
      } catch (err) {
        console.error('Failed to load event requests:', err);
        setEventRequests([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [token, statusFilter]);

  const getPageTitle = () => {
    switch (statusFilter) {
      case 'SUBMITTED':
        return 'Awaiting Quotes';
      case 'DRAFT':
        return 'Draft Requests';
      case 'BOOKED':
        return 'Booked Events';
      case 'COMPLETED':
        return 'Completed Events';
      default:
        return 'All Event Requests';
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

  // Touch handlers for mobile
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

  const selectAll = () => {
    const selectableIds = eventRequests
      .filter(r => r.status !== 'COMPLETED' && r.status !== 'BOOKED')
      .map(r => r.id);
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
          const response = await fetch(`/api/v1/event-requests/${id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          return { id, success: response.ok };
        } catch {
          return { id, success: false };
        }
      });

      const results = await Promise.all(deletePromises);
      const successfulDeletes = results.filter(r => r.success).map(r => r.id);
      
      setEventRequests(prev => prev.filter(r => !successfulDeletes.includes(r.id)));
      setSelectedIds(new Set());
      setSelectionMode(false);
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('Failed to delete:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const canDelete = (request: EventRequest) => {
    return request.status !== 'COMPLETED' && request.status !== 'BOOKED';
  };

  const selectedDeletableCount = Array.from(selectedIds).filter(id => {
    const request = eventRequests.find(r => r.id === id);
    return request && canDelete(request);
  }).length;

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
            <span className="text-stone-500">{eventRequests.length} requests</span>
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
                onClick={selectedIds.size === eventRequests.filter(r => canDelete(r)).length ? deselectAll : selectAll}
                className="btn-secondary text-sm py-2"
              >
                {selectedIds.size === eventRequests.filter(r => canDelete(r)).length ? 'Deselect All' : 'Select All'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={selectedDeletableCount === 0}
                className="btn-primary bg-red-500 hover:bg-red-600 text-sm py-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete ({selectedDeletableCount})
              </button>
            </div>
          </div>
        )}

        {/* Help text */}
        {!selectionMode && eventRequests.length > 0 && (
          <p className="text-sm text-stone-500 mb-4">
            💡 Tip: Press and hold on an item to enable selection mode
          </p>
        )}

        {/* List */}
        {eventRequests.length === 0 ? (
          <div className="card p-8 text-center">
            <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-stone-400" />
            </div>
            <h3 className="font-semibold text-stone-900 mb-2">No event requests found</h3>
            <p className="text-stone-600 mb-4">
              {statusFilter 
                ? `You don't have any ${statusFilter.toLowerCase().replace('_', ' ')} requests.`
                : "You haven't created any event requests yet."}
            </p>
            <Link to="/create-request" className="btn-primary">
              Create Request
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {eventRequests.map((request) => (
              <div
                key={request.id}
                className={`card p-5 transition-all cursor-pointer ${
                  selectedIds.has(request.id) ? 'ring-2 ring-brand-500 bg-brand-50' : 'card-hover'
                }`}
                onMouseDown={() => !selectionMode && handleMouseDown(request.id)}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onTouchStart={() => !selectionMode && handleTouchStart(request.id)}
                onTouchEnd={handleTouchEnd}
                onClick={() => {
                  if (selectionMode) {
                    if (canDelete(request)) {
                      toggleSelection(request.id);
                    }
                  } else {
                    // Navigate to detail page when not in selection mode
                    window.location.href = `/event-requests/${request.id}`;
                  }
                }}
              >
                <div className="flex items-center gap-4">
                  {/* Checkbox in selection mode */}
                  {selectionMode && (
                    <div className="flex-shrink-0">
                      {canDelete(request) ? (
                        selectedIds.has(request.id) ? (
                          <CheckSquare className="w-6 h-6 text-brand-500" />
                        ) : (
                          <Square className="w-6 h-6 text-stone-400" />
                        )
                      ) : (
                        <div className="w-6 h-6 flex items-center justify-center" title="Cannot delete completed/booked events">
                          <AlertCircle className="w-5 h-5 text-stone-300" />
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="w-12 h-12 bg-brand-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-6 h-6 text-brand-600" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-stone-900 truncate">
                      {request.title}
                    </h3>
                    <p className="text-sm text-stone-500 mt-0.5">
                      {request.eventType.replace('_', ' ')}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-stone-500 mt-2">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {format(new Date(request.eventDate), 'MMM d, yyyy')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {request.guestCount} guests
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        ${request.budgetMin.toLocaleString()} - ${request.budgetMax.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      request.status === 'SUBMITTED' 
                        ? 'bg-amber-100 text-amber-700'
                        : request.status === 'DRAFT'
                        ? 'bg-stone-100 text-stone-600'
                        : request.status === 'COMPLETED'
                        ? 'bg-green-100 text-green-700'
                        : request.status === 'BOOKED'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-stone-100 text-stone-600'
                    }`}>
                      {request.status.replace('_', ' ')}
                    </span>
                    {((request as any)._count?.quotes > 0) && (
                      <span className="px-2 py-1 bg-brand-100 text-brand-700 rounded-full text-xs font-medium">
                        {(request as any)._count?.quotes} quotes
                      </span>
                    )}
                    {!selectionMode && (
                      <Link 
                        to={`/event-requests/${request.id}`}
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

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full">
              <h3 className="font-display text-xl font-bold text-stone-900 mb-2">
                Delete Event Requests?
              </h3>
              <p className="text-stone-600 mb-6">
                Are you sure you want to delete {selectedDeletableCount} event request{selectedDeletableCount !== 1 ? 's' : ''}? 
                This action cannot be undone.
              </p>
              {selectedIds.size !== selectedDeletableCount && (
                <p className="text-amber-600 text-sm mb-4">
                  Note: {selectedIds.size - selectedDeletableCount} completed/booked event(s) will not be deleted.
                </p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="btn-secondary flex-1"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="btn-primary bg-red-500 hover:bg-red-600 flex-1"
                >
                  {isDeleting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Deleting...
                    </span>
                  ) : (
                    'Delete'
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
