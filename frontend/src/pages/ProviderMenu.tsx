import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Camera,
  Image as ImageIcon,
  CheckCircle,
  AlertCircle,
  ArrowLeft
} from 'lucide-react';
import { providersApi, menuItemsApi } from '../utils/api';

interface PricingTier {
  id?: string;
  minQuantity: number;
  maxQuantity: number | null;
  pricePerUnit: number;
}

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price: number;
  pricingTiers?: PricingTier[];
  imageUrl: string | null;
  allergens: string[];
  dietaryInfo: string[];
  isAvailable: boolean;
  displayOrder: number;
}

const DEFAULT_CATEGORIES = [
  'Appetizers',
  'Salads',
  'Soups',
  'Entrees',
  'Main Courses',
  'Sides',
  'Desserts',
  'Beverages',
  'Cocktails',
  'DJ Sets',
  'Photography Packages',
  'Videography Packages',
  'Floral Arrangements',
  'Decor Packages',
  'Equipment Rental',
  'Music Performances',
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
  'Organic',
  'Halal',
  'Kosher'
];

const ALLERGEN_OPTIONS = [
  'Nuts',
  'Dairy',
  'Gluten',
  'Shellfish',
  'Eggs',
  'Soy',
  'Fish',
  'Sesame'
];

const emptyItem = (): Omit<MenuItem, 'id'> => ({
  name: '',
  description: '',
  category: 'Other',
  price: 0,
  pricingTiers: [],
  imageUrl: null,
  allergens: [],
  dietaryInfo: [],
  isAvailable: true,
  displayOrder: 0,
});

export default function ProviderMenu() {
  useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [profile, setProfile] = useState<any>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [formData, setFormData] = useState<Omit<MenuItem, 'id'>>(emptyItem());
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [usePricingTiers, setUsePricingTiers] = useState(false);
  
  // Banner and logo state
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const profiles: any = await providersApi.getMyProfiles(token);
      if (profiles.data && profiles.data.length > 0) {
        const currentProfile = profiles.data[0];
        setProfile(currentProfile);
        setBannerPreview(currentProfile.bannerImageUrl);
        setLogoPreview(currentProfile.logoUrl);

        // Load menu items from backend
        const itemsRes: any = await menuItemsApi.getByProvider(currentProfile.id);
        if (itemsRes.data) {
          setMenuItems(itemsRes.data);
        }
      } else {
        navigate('/become-provider');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image must be less than 5MB');
        return;
      }
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
      if (file.size > 5 * 1024 * 1024) {
        setError('Image must be less than 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setSavingProfile(true);
      setError(null);
      const token = localStorage.getItem('token');
      if (!token) return;

      await providersApi.updateProfile({
        bannerImageUrl: bannerPreview,
        logoUrl: logoPreview
      }, token);

      setSuccess('Profile images updated successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile images');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image must be less than 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setImagePreview(result);
        setFormData(prev => ({ ...prev, imageUrl: result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const openAddModal = () => {
    setEditingItem(null);
    setFormData(emptyItem());
    setImagePreview(null);
    setUsePricingTiers(false);
    setShowModal(true);
  };

  const openEditModal = (item: MenuItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || '',
      category: item.category,
      price: item.price,
      pricingTiers: item.pricingTiers || [],
      imageUrl: item.imageUrl,
      allergens: item.allergens,
      dietaryInfo: item.dietaryInfo,
      isAvailable: item.isAvailable,
      displayOrder: item.displayOrder,
    });
    setImagePreview(item.imageUrl);
    setUsePricingTiers((item.pricingTiers && item.pricingTiers.length > 0) || false);
    setShowModal(true);
  };

  const handleSaveItem = async () => {
    if (!formData.name.trim()) {
      setError('Item name is required');
      return;
    }
    
    // Calculate the max price from tiers or use the single price
    const maxPrice = usePricingTiers && formData.pricingTiers && formData.pricingTiers.length > 0
      ? Math.max(...formData.pricingTiers.map(t => t.pricePerUnit))
      : formData.price;
    
    if (maxPrice <= 0) {
      setError('Price must be greater than 0');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const token = localStorage.getItem('token');
      if (!token) return;

      // Prepare data with calculated max price and tiers
      const dataToSave = {
        ...formData,
        price: maxPrice,
        pricingTiers: usePricingTiers ? formData.pricingTiers : [],
      };

      if (editingItem) {
        // Update
        const res: any = await menuItemsApi.update(editingItem.id, dataToSave as any, token);
        if (res.success) {
          setMenuItems(prev => prev.map(item =>
            item.id === editingItem.id ? { ...item, ...res.data } : item
          ));
          setSuccess('Item updated successfully!');
        }
      } else {
        // Create
        const res: any = await menuItemsApi.create(dataToSave as any, token);
        if (res.success) {
          setMenuItems(prev => [...prev, res.data]);
          setSuccess('Item added successfully!');
        }
      }

      setShowModal(false);
      setEditingItem(null);
      setFormData(emptyItem());
      setImagePreview(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      setDeletingId(itemId);
      const token = localStorage.getItem('token');
      if (!token) return;

      await menuItemsApi.delete(itemId, token);
      setMenuItems(prev => prev.filter(item => item.id !== itemId));
      setSuccess('Item deleted successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete item');
    } finally {
      setDeletingId(null);
    }
  };

  const toggleDietaryInfo = (option: string) => {
    setFormData(prev => ({
      ...prev,
      dietaryInfo: prev.dietaryInfo.includes(option)
        ? prev.dietaryInfo.filter(d => d !== option)
        : [...prev.dietaryInfo, option],
    }));
  };

  const toggleAllergen = (option: string) => {
    setFormData(prev => ({
      ...prev,
      allergens: prev.allergens.includes(option)
        ? prev.allergens.filter(a => a !== option)
        : [...prev.allergens, option],
    }));
  };

  const addPricingTier = () => {
    const newTier: PricingTier = {
      minQuantity: 1,
      maxQuantity: null,
      pricePerUnit: 0,
    };
    setFormData(prev => ({
      ...prev,
      pricingTiers: [...(prev.pricingTiers || []), newTier],
    }));
  };

  const updatePricingTier = (index: number, field: keyof PricingTier, value: number | null) => {
    setFormData(prev => ({
      ...prev,
      pricingTiers: prev.pricingTiers?.map((tier, i) =>
        i === index ? { ...tier, [field]: value } : tier
      ) || [],
    }));
  };

  const removePricingTier = (index: number) => {
    setFormData(prev => ({
      ...prev,
      pricingTiers: prev.pricingTiers?.filter((_, i) => i !== index) || [],
    }));
  };

  // Get unique categories from items
  const categories = ['All', ...Array.from(new Set(menuItems.map(item => item.category)))].filter(Boolean);
  const filteredItems = activeCategory === 'All'
    ? menuItems
    : menuItems.filter(item => item.category === activeCategory);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="section-padding py-12 text-center">
        <p className="text-stone-600">No provider profile found.</p>
        <Link to="/become-provider" className="btn-primary mt-4 inline-block">
          Create Provider Profile
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-12">
      {/* Messages */}
      {success && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2">
          <div className="px-6 py-3 bg-green-500 text-white rounded-xl shadow-lg flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            {success}
          </div>
        </div>
      )}
      {error && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50">
          <div className="px-6 py-3 bg-red-500 text-white rounded-xl shadow-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
            <button onClick={() => setError(null)} className="ml-2 hover:opacity-80">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Banner Image Section */}
      <div className="relative h-64 bg-gradient-to-br from-brand-500 to-brand-700 z-20">
        {bannerPreview ? (
          <img src={bannerPreview} alt="Banner" className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white">
              <Camera className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium">Add a cover photo</p>
            </div>
          </div>
        )}
        <label className="absolute top-4 right-4 btn-secondary cursor-pointer z-30">
          <Camera className="w-4 h-4 mr-2" />
          {bannerPreview ? 'Change Cover' : 'Add Cover'}
          <input
            type="file"
            accept="image/*"
            onChange={handleBannerUpload}
            className="hidden"
          />
        </label>
      </div>

      {/* Profile Section with Logo */}
      <div className="section-padding -mt-20 relative z-10">
        <div className="card p-6">
          <div className="flex items-start gap-6" style={{ transform: 'translate(48.51px, 156.30px)' }}>
            {/* Logo */}
            <div className="relative -mt-16" style={{ transform: 'translate(42.52px, 210.30px)' }}>
              <div className="w-32 h-32 bg-white border-4 border-white rounded-2xl overflow-hidden shadow-xl">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-brand-100 flex items-center justify-center">
                    <span className="text-3xl font-bold text-brand-600">
                      {profile?.businessName?.[0] || 'P'}
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

            {/* Profile Info */}
            <div className="flex-1 pt-8" style={{ transform: 'translate(197.51px, 200.30px)' }}>
              <h2 className="font-display text-2xl font-bold text-stone-900">
                {profile?.businessName || 'My Business'}
              </h2>
              {profile?.businessDescription && (
                <p className="text-stone-600 mt-2 line-clamp-2">{profile.businessDescription}</p>
              )}
              <button
                onClick={handleSaveProfile}
                disabled={savingProfile}
                className="btn-primary mt-4"
              >
                <Save className="w-4 h-4 mr-2" />
                {savingProfile ? 'Saving...' : 'Save Profile Images'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="bg-gradient-to-r from-brand-500 to-brand-700 text-white mt-8">
        <div className="section-padding py-8">
          <Link to="/provider/dashboard" className="text-white/80 hover:text-white flex items-center gap-1 mb-4 text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-3xl font-bold">My Menu & Services</h1>
              <p className="mt-2 text-white/80">
                Manage the items and services you offer to clients. 
                {menuItems.length > 0 && ` ${menuItems.length} item${menuItems.length !== 1 ? 's' : ''} listed.`}
              </p>
            </div>
            <button onClick={openAddModal} className="btn-primary bg-white text-brand-700 hover:bg-white/90">
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </button>
          </div>
        </div>
      </div>

      {/* Category Filter */}
      {categories.length > 1 && (
        <div className="section-padding pt-6 pb-0">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  activeCategory === cat
                    ? 'bg-brand-500 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {cat}
                {cat !== 'All' && (
                  <span className="ml-1.5 opacity-70">
                    ({menuItems.filter(i => i.category === cat).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Menu Items Grid */}
      <div className="section-padding mt-6">
        {filteredItems.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map(item => (
              <div
                key={item.id}
                className={`card overflow-hidden hover:shadow-lg transition-shadow ${
                  !item.isAvailable ? 'opacity-60' : ''
                }`}
              >
                {/* Item Image */}
                <div className="h-48 bg-gradient-to-br from-stone-100 to-stone-200 relative">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <ImageIcon className="w-16 h-16 text-stone-300" />
                    </div>
                  )}
                  {!item.isAvailable && (
                    <div className="absolute top-3 left-3 px-2 py-1 bg-red-500 text-white text-xs font-medium rounded-lg">
                      Unavailable
                    </div>
                  )}
                  <div className="absolute top-3 right-3 px-2 py-1 bg-black/50 text-white text-xs rounded-lg backdrop-blur-sm">
                    {item.category}
                  </div>
                </div>

                {/* Item Info */}
                <div className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-stone-900 text-lg">{item.name}</h3>
                    <div className="flex-shrink-0 ml-2 text-right">
                      <div className="text-xl font-bold text-brand-600">
                        ${item.price.toFixed(2)}
                      </div>
                      {item.pricingTiers && item.pricingTiers.length > 0 && (
                        <div className="text-xs text-stone-500 mt-1">
                          {item.pricingTiers
                            .sort((a, b) => b.pricePerUnit - a.pricePerUnit)
                            .map((tier, idx) => (
                              <div key={idx}>
                                {tier.minQuantity}-{tier.maxQuantity || '∞'}: ${tier.pricePerUnit.toFixed(2)}
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {item.description && (
                    <p className="text-sm text-stone-600 mb-3 line-clamp-2">{item.description}</p>
                  )}

                  {/* Dietary Info */}
                  {item.dietaryInfo.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {item.dietaryInfo.map(info => (
                        <span key={info} className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                          {info}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Allergens */}
                  {item.allergens.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {item.allergens.map(allergen => (
                        <span key={allergen} className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                          ⚠ {allergen}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-stone-100">
                    <button
                      onClick={() => openEditModal(item)}
                      className="flex-1 btn-ghost text-sm py-2 justify-center"
                    >
                      <Edit2 className="w-3.5 h-3.5 mr-1.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      disabled={deletingId === item.id}
                      className="flex-1 btn-ghost text-sm py-2 text-red-600 hover:bg-red-50 justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                      {deletingId === item.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <ImageIcon className="w-20 h-20 mx-auto mb-4 text-stone-200" />
            <h3 className="text-xl font-semibold text-stone-700 mb-2">No items yet</h3>
            <p className="text-stone-500 mb-6 max-w-md mx-auto">
              Add your menu items, service packages, or offerings so clients can see what you provide.
            </p>
            <button onClick={openAddModal} className="btn-primary">
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Item
            </button>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white rounded-t-2xl border-b border-stone-100 px-6 py-4 flex items-center justify-between z-10">
              <h3 className="font-display text-xl font-bold text-stone-900">
                {editingItem ? 'Edit Item' : 'Add New Item'}
              </h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingItem(null);
                  setFormData(emptyItem());
                  setImagePreview(null);
                }}
                className="p-2 hover:bg-stone-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Item Image</label>
                <div className="relative h-48 bg-stone-100 rounded-xl overflow-hidden group cursor-pointer"
                  onClick={() => imageInputRef.current?.click()}
                >
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-stone-400">
                      <Camera className="w-10 h-10 mb-2" />
                      <p className="text-sm font-medium">Click to upload image</p>
                      <p className="text-xs mt-1">JPEG, PNG, WebP (Max 5MB)</p>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 text-white font-medium text-sm bg-black/50 px-4 py-2 rounded-lg backdrop-blur-sm">
                      {imagePreview ? 'Change Image' : 'Upload Image'}
                    </span>
                  </div>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </div>
                {imagePreview && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setImagePreview(null);
                      setFormData(prev => ({ ...prev, imageUrl: null }));
                    }}
                    className="text-sm text-red-600 hover:text-red-700 mt-2"
                  >
                    Remove image
                  </button>
                )}
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Item Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Grilled Salmon, Photography Package, DJ Set"
                  className="input-field"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe the item, what's included, etc."
                  rows={3}
                  className="input-field"
                />
              </div>

              {/* Category + Price */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="input-field"
                  >
                    {DEFAULT_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                {!usePricingTiers && (
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                      Price ($) *
                    </label>
                    <input
                      type="number"
                      value={formData.price || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      className="input-field"
                    />
                  </div>
                )}
              </div>

              {/* Quantity Pricing Toggle */}
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={usePricingTiers}
                    onChange={(e) => {
                      setUsePricingTiers(e.target.checked);
                      if (e.target.checked && (!formData.pricingTiers || formData.pricingTiers.length === 0)) {
                        addPricingTier();
                      }
                    }}
                    className="w-5 h-5 rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                  />
                  <div>
                    <p className="font-medium text-purple-900">Use Quantity-Based Pricing</p>
                    <p className="text-sm text-purple-700">
                      Set different prices based on quantity (e.g., 1-10: $15, 11-50: $12, 51+: $10)
                    </p>
                  </div>
                </label>
              </div>

              {/* Pricing Tiers */}
              {usePricingTiers && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-stone-700">
                      Quantity Tiers
                    </label>
                    <button
                      type="button"
                      onClick={addPricingTier}
                      className="btn-secondary text-sm"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Tier
                    </button>
                  </div>

                  {formData.pricingTiers && formData.pricingTiers.length > 0 ? (
                    <div className="space-y-3">
                      {formData.pricingTiers.map((tier, index) => (
                        <div key={index} className="bg-stone-50 rounded-xl p-4 border border-stone-200">
                          <div className="flex items-start justify-between mb-3">
                            <span className="text-sm font-medium text-stone-500">Tier {index + 1}</span>
                            <button
                              type="button"
                              onClick={() => removePricingTier(index)}
                              className="p-1 text-red-500 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-stone-600 mb-1">
                                Min Qty *
                              </label>
                              <input
                                type="number"
                                value={tier.minQuantity || ''}
                                onChange={(e) => updatePricingTier(index, 'minQuantity', parseInt(e.target.value) || 0)}
                                className="input-field text-sm"
                                min="0"
                                placeholder="1"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-stone-600 mb-1">
                                Max Qty
                              </label>
                              <input
                                type="number"
                                value={tier.maxQuantity || ''}
                                onChange={(e) => updatePricingTier(index, 'maxQuantity', e.target.value ? parseInt(e.target.value) : null)}
                                className="input-field text-sm"
                                min="0"
                                placeholder="∞"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-stone-600 mb-1">
                                Price ($) *
                              </label>
                              <input
                                type="number"
                                value={tier.pricePerUnit || ''}
                                onChange={(e) => updatePricingTier(index, 'pricePerUnit', parseFloat(e.target.value) || 0)}
                                className="input-field text-sm"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-stone-50 rounded-xl border-2 border-dashed border-stone-200">
                      <p className="text-stone-500 mb-3">No pricing tiers yet</p>
                      <button
                        type="button"
                        onClick={addPricingTier}
                        className="btn-primary text-sm"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Your First Tier
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Dietary Information */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Dietary Information
                </label>
                <div className="flex flex-wrap gap-2">
                  {DIETARY_OPTIONS.map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => toggleDietaryInfo(option)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        formData.dietaryInfo.includes(option)
                          ? 'bg-green-500 text-white'
                          : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              {/* Allergens */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Allergens
                </label>
                <div className="flex flex-wrap gap-2">
                  {ALLERGEN_OPTIONS.map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => toggleAllergen(option)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        formData.allergens.includes(option)
                          ? 'bg-amber-500 text-white'
                          : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              {/* Availability toggle */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, isAvailable: !prev.isAvailable }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.isAvailable ? 'bg-green-500' : 'bg-stone-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      formData.isAvailable ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className="text-sm text-stone-700">
                  {formData.isAvailable ? 'Available' : 'Unavailable'}
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white rounded-b-2xl border-t border-stone-100 px-6 py-4 flex gap-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingItem(null);
                  setFormData(emptyItem());
                  setImagePreview(null);
                }}
                className="flex-1 btn-ghost"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveItem}
                disabled={saving}
                className="flex-1 btn-primary"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : editingItem ? 'Update Item' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
