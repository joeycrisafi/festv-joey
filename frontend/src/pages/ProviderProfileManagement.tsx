import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Upload,
  X,
  Plus,
  Edit2,
  Trash2,
  Save,
  Camera,
  Image as ImageIcon,
  DollarSign,
  Star,
  MapPin,
  Briefcase
} from 'lucide-react';
import { providersApi } from '../utils/api';

interface MenuItem {
  id?: string;
  name: string;
  description: string;
  category: string;
  price: number;
  imageUrl?: string;
  allergens: string[];
  dietaryInfo: string[];
  isAvailable: boolean;
  displayOrder: number;
}

const MENU_CATEGORIES = [
  'Appetizers',
  'Salads',
  'Soups',
  'Entrees',
  'Sides',
  'Desserts',
  'Beverages',
  'Other'
];

const DIETARY_OPTIONS = [
  'Vegetarian',
  'Vegan',
  'Gluten-Free',
  'Dairy-Free',
  'Nut-Free',
  'Keto',
  'Paleo',
  'Organic'
];

export default function ProviderProfileManagement() {
  useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Profile state
  const [profile, setProfile] = useState<any>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  
  // Menu items state
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [editingMenu, setEditingMenu] = useState<MenuItem | null>(null);
  const [newMenuItem, setNewMenuItem] = useState<MenuItem>({
    name: '',
    description: '',
    category: 'Appetizers',
    price: 0,
    allergens: [],
    dietaryInfo: [],
    isAvailable: true,
    displayOrder: 0
  });

  useEffect(() => {
    loadProfile();
    loadMenuItems();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }
      
      const profiles = await providersApi.getMyProfiles(token) as any;
      if (profiles.data && profiles.data.length > 0) {
        const currentProfile = profiles.data[0];
        setProfile(currentProfile);
        setBannerPreview(currentProfile.bannerImageUrl);
        setLogoPreview(currentProfile.logoUrl);
      } else {
        navigate('/become-provider');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const loadMenuItems = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/v1/providers/menu-items`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      if (data.success) {
        setMenuItems(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load menu items:', err);
    }
  };

  const handleBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBannerPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveImages = async () => {
    try {
      setSaving(true);
      setError(null);
      const token = localStorage.getItem('token');
      
      await providersApi.updateProfile({
        bannerImageUrl: bannerPreview,
        logoUrl: logoPreview
      }, token!);
      
      setSuccess('Profile images updated successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update images');
    } finally {
      setSaving(false);
    }
  };

  const handleAddMenuItem = async () => {
    if (!newMenuItem.name || !newMenuItem.price) {
      setError('Please fill in menu item name and price');
      return;
    }
    
    try {
      setSaving(true);
      setError(null);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/v1/providers/menu-items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newMenuItem)
      });
      
      const data = await response.json();
      
      if (data.success) {
        await loadMenuItems();
        setNewMenuItem({
          name: '',
          description: '',
          category: 'Appetizers',
          price: 0,
          allergens: [],
          dietaryInfo: [],
          isAvailable: true,
          displayOrder: menuItems.length
        });
        setShowAddMenu(false);
        setSuccess('Menu item added successfully!');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Failed to add menu item');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to add menu item');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMenuItem = async (id: string) => {
    if (!confirm('Are you sure you want to delete this menu item?')) return;
    
    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/v1/providers/menu-items/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        await loadMenuItems();
        setSuccess('Menu item deleted successfully!');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Failed to delete menu item');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete menu item');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="section-padding py-12">
        <div className="text-center">
          <p className="text-stone-600">No provider profile found.</p>
          <Link to="/become-provider" className="btn-primary mt-4">
            Create Provider Profile
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-12">
      {/* Messages */}
      {error && (
        <div className="section-padding pt-4">
          <div className="max-w-4xl mx-auto p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)}><X className="w-5 h-5" /></button>
          </div>
        </div>
      )}
      {success && (
        <div className="section-padding pt-4">
          <div className="max-w-4xl mx-auto p-4 bg-green-50 border border-green-200 rounded-xl text-green-800 flex items-center justify-between">
            <span>{success}</span>
            <button onClick={() => setSuccess(null)}><X className="w-5 h-5" /></button>
          </div>
        </div>
      )}

      {/* Banner Image Section */}
      <div className="relative h-80 bg-gradient-to-br from-brand-500 to-brand-700 z-20">
        {bannerPreview ? (
          <img src={bannerPreview} alt="Banner" className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white">
              <Camera className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Add a banner image</p>
            </div>
          </div>
        )}
        
        {/* Upload Banner Button */}
        <label className="absolute top-4 right-4 btn-secondary cursor-pointer z-30">
          <Upload className="w-4 h-4 mr-2" />
          Upload Banner
          <input
            type="file"
            accept="image/*"
            onChange={handleBannerUpload}
            className="hidden"
            onClick={(e) => e.stopPropagation()}
          />
        </label>
      </div>

      {/* Profile Header */}
      <div className="section-padding -mt-16 relative z-10">
        <div className="card p-6 md:p-8">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            {/* Logo */}
            <div className="relative -mt-4">
              <div className="w-32 h-32 bg-white border-4 border-white rounded-2xl overflow-hidden shadow-xl">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-brand-100 flex items-center justify-center">
                    <span className="text-4xl font-bold text-brand-600">
                      {profile.businessName[0]}
                    </span>
                  </div>
                )}
              </div>
              <label className="absolute bottom-0 right-0 w-10 h-10 bg-brand-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-brand-600 transition-colors shadow-lg">
                <Camera className="w-5 h-5 text-white" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Info */}
            <div className="flex-1">
              <h1 className="font-display text-3xl font-bold text-stone-900">
                {profile.businessName}
              </h1>
              <p className="text-stone-600 mt-2">{profile.businessDescription}</p>
              
              <div className="flex flex-wrap items-center gap-4 mt-4">
                <div className="flex items-center gap-2 text-stone-600">
                  <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                  <span className="font-semibold">{profile.averageRating || '0.0'}</span>
                  <span>({profile.totalReviews || 0} reviews)</span>
                </div>
                <div className="flex items-center gap-2 text-stone-600">
                  <Briefcase className="w-5 h-5" />
                  <span>{profile.totalBookings || 0} bookings</span>
                </div>
                <div className="flex items-center gap-2 text-stone-600">
                  <MapPin className="w-5 h-5" />
                  <span>{profile.serviceRadius} mile radius</span>
                </div>
                {profile.pricePerPerson && (
                  <div className="flex items-center gap-2 text-stone-600">
                    <DollarSign className="w-5 h-5" />
                    <span>From ${profile.pricePerPerson}/person</span>
                  </div>
                )}
              </div>

              <button
                onClick={handleSaveImages}
                disabled={saving}
                className="btn-primary mt-4"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save Images'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Menu Items Section */}
      {profile.primaryType === 'CATERER' && (
        <div className="section-padding mt-8">
          <div className="card p-6 md:p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-display text-2xl font-bold text-stone-900">Menu Items</h2>
                <p className="text-stone-600 mt-1">Add and manage your food offerings</p>
              </div>
              <button
                onClick={() => setShowAddMenu(true)}
                className="btn-primary"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </button>
            </div>

            {/* Menu Items Grid */}
            {menuItems.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {menuItems.map(item => (
                  <div key={item.id} className="border border-stone-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                    {/* Item Image */}
                    <div className="h-48 bg-gradient-to-br from-stone-200 to-stone-300 flex items-center justify-center">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-12 h-12 text-stone-400" />
                      )}
                    </div>
                    
                    {/* Item Info */}
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-stone-900">{item.name}</h3>
                          <span className="text-xs text-stone-500">{item.category}</span>
                        </div>
                        <span className="text-lg font-bold text-brand-600">${item.price}</span>
                      </div>
                      
                      {item.description && (
                        <p className="text-sm text-stone-600 mb-3 line-clamp-2">{item.description}</p>
                      )}
                      
                      {item.dietaryInfo && item.dietaryInfo.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {item.dietaryInfo.map(info => (
                            <span key={info} className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
                              {info}
                            </span>
                          ))}
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingMenu(item)}
                          className="flex-1 btn-ghost text-sm py-1"
                        >
                          <Edit2 className="w-3 h-3 mr-1" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteMenuItem(item.id!)}
                          className="flex-1 btn-ghost text-sm py-1 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-stone-500">
                <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p>No menu items yet. Add your first item to get started!</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit Menu Item Modal */}
      {(showAddMenu || editingMenu) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display text-2xl font-bold text-stone-900">
                {editingMenu ? 'Edit Menu Item' : 'Add Menu Item'}
              </h3>
              <button
                onClick={() => {
                  setShowAddMenu(false);
                  setEditingMenu(null);
                }}
                className="p-2 hover:bg-stone-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Item Name *
                </label>
                <input
                  type="text"
                  value={newMenuItem.name}
                  onChange={(e) => setNewMenuItem({ ...newMenuItem, name: e.target.value })}
                  placeholder="e.g., Grilled Salmon"
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Description
                </label>
                <textarea
                  value={newMenuItem.description}
                  onChange={(e) => setNewMenuItem({ ...newMenuItem, description: e.target.value })}
                  placeholder="Describe the dish..."
                  rows={3}
                  className="input-field"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Category *
                  </label>
                  <select
                    value={newMenuItem.category}
                    onChange={(e) => setNewMenuItem({ ...newMenuItem, category: e.target.value })}
                    className="input-field"
                  >
                    {MENU_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Price *
                  </label>
                  <input
                    type="number"
                    value={newMenuItem.price}
                    onChange={(e) => setNewMenuItem({ ...newMenuItem, price: parseFloat(e.target.value) })}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Dietary Information
                </label>
                <div className="flex flex-wrap gap-2">
                  {DIETARY_OPTIONS.map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        const current = newMenuItem.dietaryInfo;
                        setNewMenuItem({
                          ...newMenuItem,
                          dietaryInfo: current.includes(option)
                            ? current.filter(d => d !== option)
                            : [...current, option]
                        });
                      }}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                        newMenuItem.dietaryInfo.includes(option)
                          ? 'bg-green-500 text-white'
                          : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowAddMenu(false);
                    setEditingMenu(null);
                  }}
                  className="flex-1 btn-ghost"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddMenuItem}
                  disabled={saving}
                  className="flex-1 btn-primary"
                >
                  {saving ? 'Saving...' : (editingMenu ? 'Update Item' : 'Add Item')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
