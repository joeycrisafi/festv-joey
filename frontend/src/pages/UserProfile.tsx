import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  User as UserIcon,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Briefcase,
  Edit2,
  Save,
  X,
  Camera,
  Upload,
  Trash2,
  CheckCircle,
  Shield,
  Plus,
  Image as ImageIcon,
  Layers
} from 'lucide-react';
import { usersApi, providersApi, menuItemsApi } from '../utils/api';

// ── Menu Item types ──
interface PricingTier {
  id?: string;
  label: string;
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
  imageUrl: string | null;
  allergens: string[];
  dietaryInfo: string[];
  isAvailable: boolean;
  displayOrder: number;
  pricingTiers?: PricingTier[];
}

const DEFAULT_CATEGORIES = [
  'Appetizers', 'Salads', 'Soups', 'Entrees', 'Main Courses', 'Sides',
  'Desserts', 'Beverages', 'Cocktails', 'DJ Sets', 'Photography Packages',
  'Videography Packages', 'Floral Arrangements', 'Decor Packages',
  'Equipment Rental', 'Music Performances', 'Other'
];

const DIETARY_OPTIONS = [
  'Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Nut-Free',
  'Keto', 'Paleo', 'Organic', 'Halal', 'Kosher'
];

const ALLERGEN_OPTIONS = [
  'Nuts', 'Dairy', 'Gluten', 'Shellfish', 'Eggs', 'Soy', 'Fish', 'Sesame'
];

const emptyTier = (): PricingTier => ({
  label: '',
  minQuantity: 1,
  maxQuantity: null,
  pricePerUnit: 0,
});

const emptyItem = (): Omit<MenuItem, 'id'> => ({
  name: '',
  description: '',
  category: 'Other',
  price: 0,
  imageUrl: null,
  allergens: [],
  dietaryInfo: [],
  isAvailable: true,
  displayOrder: 0,
  pricingTiers: [],
});

export default function UserProfile() {
  const { user, token, refreshUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Image states
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [savingImages, setSavingImages] = useState(false);
  
  // Provider states
  const [, setProviderProfile] = useState<any>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [menuFormData, setMenuFormData] = useState<Omit<MenuItem, 'id'>>(emptyItem());
  const [menuImagePreview, setMenuImagePreview] = useState<string | null>(null);
  const [savingItem, setSavingItem] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [useTieredPricing, setUseTieredPricing] = useState(false);
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const menuImageInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    phoneNumber: user?.phoneNumber || '',
    address: user?.address || '',
    city: user?.city || '',
    state: user?.state || '',
    zipCode: user?.zipCode || '',
  });

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phoneNumber: user.phoneNumber || '',
        address: user.address || '',
        city: user.city || '',
        state: user.state || '',
        zipCode: user.zipCode || '',
      });
      setAvatarPreview(user.avatarUrl || null);
      setBannerPreview(user.bannerUrl || null);
    }
  }, [user]);

  // Load provider data if user is a provider
  const isProvider = user?.roles?.includes('PROVIDER') || user?.role === 'PROVIDER';
  
  useEffect(() => {
    if (isProvider) {
      loadProviderData();
    }
  }, [isProvider]);

  const loadProviderData = async () => {
    try {
      setLoadingMenu(true);
      const token = localStorage.getItem('token');
      if (!token) return;
      const profiles: any = await providersApi.getMyProfiles(token);
      if (profiles.data && profiles.data.length > 0) {
        const profile = profiles.data[0];
        setProviderProfile(profile);
        const itemsRes: any = await menuItemsApi.getByProvider(profile.id);
        if (itemsRes.data) {
          setMenuItems(itemsRes.data);
        }
      }
    } catch (err: any) {
      console.error('Failed to load provider data:', err);
    } finally {
      setLoadingMenu(false);
    }
  };

  // ── Image handlers ──
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { setError('Image must be less than 5MB'); return; }
      const reader = new FileReader();
      reader.onloadend = () => setAvatarPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { setError('Banner image must be less than 10MB'); return; }
      const reader = new FileReader();
      reader.onloadend = () => setBannerPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveBanner = async () => {
    try {
      setSavingImages(true);
      await usersApi.updateBanner(null, token || '');
      setBannerPreview(null);
      await refreshUser();
      setSuccess('Banner removed');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to remove banner');
    } finally {
      setSavingImages(false);
    }
  };

  const handleSaveImages = async () => {
    try {
      setSavingImages(true);
      setError(null);
      if (avatarPreview !== (user?.avatarUrl || null)) {
        await usersApi.updateAvatar(avatarPreview || '', token || '');
      }
      if (bannerPreview !== (user?.bannerUrl || null)) {
        await usersApi.updateBanner(bannerPreview, token || '');
      }
      await refreshUser();
      setSuccess('Profile images updated!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update images');
    } finally {
      setSavingImages(false);
    }
  };

  // ── Profile form handlers ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setSuccess(null); setIsSaving(true);
    try {
      await usersApi.updateProfile(formData, token || '');
      await refreshUser();
      setSuccess('Profile updated successfully!');
      setIsEditing(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (user) {
      setFormData({
        firstName: user.firstName || '', lastName: user.lastName || '',
        phoneNumber: user.phoneNumber || '', address: user.address || '',
        city: user.city || '', state: user.state || '', zipCode: user.zipCode || '',
      });
    }
    setIsEditing(false);
    setError(null);
  };

  // ── Menu item handlers ──
  const handleMenuImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { setError('Image must be less than 5MB'); return; }
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setMenuImagePreview(result);
        setMenuFormData(prev => ({ ...prev, imageUrl: result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const openAddModal = () => {
    setEditingItem(null);
    setMenuFormData(emptyItem());
    setMenuImagePreview(null);
    setUseTieredPricing(false);
    setPricingTiers([]);
    setShowMenuModal(true);
  };

  const openEditModal = (item: MenuItem) => {
    setEditingItem(item);
    setMenuFormData({
      name: item.name, description: item.description || '', category: item.category,
      price: item.price, imageUrl: item.imageUrl, allergens: item.allergens,
      dietaryInfo: item.dietaryInfo, isAvailable: item.isAvailable,
      displayOrder: item.displayOrder,
    });
    setMenuImagePreview(item.imageUrl);
    const hasTiers = item.pricingTiers && item.pricingTiers.length > 0;
    setUseTieredPricing(!!hasTiers);
    setPricingTiers(hasTiers ? item.pricingTiers! : []);
    setShowMenuModal(true);
  };

  const handleSaveItem = async () => {
    if (!menuFormData.name.trim()) { setError('Item name is required'); return; }
    if (!useTieredPricing && menuFormData.price <= 0) { setError('Price must be greater than 0'); return; }
    if (useTieredPricing && pricingTiers.length === 0) { setError('Add at least one pricing tier'); return; }

    try {
      setSavingItem(true); setError(null);
      const token = localStorage.getItem('token');
      if (!token) return;

      const payload = {
        ...menuFormData,
        pricingTiers: useTieredPricing ? pricingTiers : [],
        price: useTieredPricing ? (pricingTiers[0]?.pricePerUnit || 0) : menuFormData.price,
      };

      if (editingItem) {
        const res: any = await menuItemsApi.update(editingItem.id, payload as any, token);
        if (res.success) {
          setMenuItems(prev => prev.map(item =>
            item.id === editingItem.id ? { ...item, ...res.data } : item
          ));
          setSuccess('Item updated!');
        }
      } else {
        const res: any = await menuItemsApi.create(payload as any, token);
        if (res.success) {
          setMenuItems(prev => [...prev, res.data]);
          setSuccess('Item added!');
        }
      }
      setShowMenuModal(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save item');
    } finally {
      setSavingItem(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      setDeletingId(itemId);
      const token = localStorage.getItem('token');
      if (!token) return;
      await menuItemsApi.delete(itemId, token);
      setMenuItems(prev => prev.filter(item => item.id !== itemId));
      setSuccess('Item deleted');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete item');
    } finally {
      setDeletingId(null);
    }
  };

  const addTier = () => {
    setPricingTiers(prev => [...prev, emptyTier()]);
  };

  const updateTier = (index: number, field: keyof PricingTier, value: any) => {
    setPricingTiers(prev => prev.map((t, i) => i === index ? { ...t, [field]: value } : t));
  };

  const removeTier = (index: number) => {
    setPricingTiers(prev => prev.filter((_, i) => i !== index));
  };

  const toggleDietaryInfo = (option: string) => {
    setMenuFormData(prev => ({
      ...prev,
      dietaryInfo: prev.dietaryInfo.includes(option)
        ? prev.dietaryInfo.filter(d => d !== option)
        : [...prev.dietaryInfo, option],
    }));
  };

  const toggleAllergen = (option: string) => {
    setMenuFormData(prev => ({
      ...prev,
      allergens: prev.allergens.includes(option)
        ? prev.allergens.filter(a => a !== option)
        : [...prev.allergens, option],
    }));
  };

  const imagesChanged = avatarPreview !== (user?.avatarUrl || null) || 
                         bannerPreview !== (user?.bannerUrl || null);

  // Menu filtering
  const categories = ['All', ...Array.from(new Set(menuItems.map(item => item.category)))].filter(Boolean);
  const filteredItems = activeCategory === 'All'
    ? menuItems
    : menuItems.filter(item => item.category === activeCategory);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="pb-12">
      {/* Toast messages */}
      {success && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2">
          <div className="px-6 py-3 bg-green-500 text-white rounded-xl shadow-lg flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />{success}
          </div>
        </div>
      )}
      {error && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50">
          <div className="px-6 py-3 bg-red-500 text-white rounded-xl shadow-lg flex items-center gap-2">
            <X className="w-5 h-5" />{error}
            <button onClick={() => setError(null)} className="ml-2 hover:opacity-80"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* ─── Banner Section ─── */}
      <div className="relative h-48 md:h-64 lg:h-72 bg-gradient-to-br from-brand-400 via-brand-500 to-brand-700 overflow-hidden">
        {bannerPreview ? (
          <img src={bannerPreview} alt="Profile Banner" className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white/60">
              <Camera className="w-12 h-12 mx-auto mb-2" />
              <p className="text-sm font-medium">Add a cover photo</p>
            </div>
          </div>
        )}
        
        {/* Banner buttons – always visible, bottom-right */}
        <div className="absolute bottom-4 right-4 flex gap-2 z-10">
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleBannerChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => bannerInputRef.current?.click()}
            className="px-4 py-2 bg-white/90 hover:bg-white text-stone-800 rounded-lg text-sm font-medium flex items-center gap-2 shadow-lg backdrop-blur-sm transition-colors"
          >
            <Upload className="w-4 h-4" />
            {bannerPreview ? 'Change Cover' : 'Add Cover'}
          </button>
          {bannerPreview && (
            <button
              onClick={handleRemoveBanner}
              disabled={savingImages}
              className="px-4 py-2 bg-red-500/90 hover:bg-red-500 text-white rounded-lg text-sm font-medium flex items-center gap-2 shadow-lg backdrop-blur-sm transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Remove
            </button>
          )}
        </div>
      </div>

      {/* ─── Profile Header Card ─── */}
      <div className="section-padding -mt-12 relative z-10">
        <div className="max-w-4xl mx-auto">
          <div className="card p-6 md:p-8">
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start">
              {/* Avatar – shifted down to overlap with the name area */}
              <div className="relative flex-shrink-0 -mt-16 sm:-mt-20 sm:mb-0 mb-2">
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-white shadow-xl overflow-hidden bg-gradient-to-br from-brand-400 to-brand-600">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt={`${user.firstName} ${user.lastName}`} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-white font-bold text-3xl sm:text-4xl">
                        {user.firstName?.[0]}{user.lastName?.[0]}
                      </span>
                    </div>
                  )}
                </div>
                <label className="absolute bottom-0 right-0 w-9 h-9 bg-brand-500 hover:bg-brand-600 rounded-full flex items-center justify-center cursor-pointer shadow-lg transition-colors">
                  <Camera className="w-4 h-4 text-white" />
                  <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarChange} className="hidden" />
                </label>
              </div>

              {/* User Info – sits beside the avatar, name aligns near bottom of avatar */}
              <div className="flex-1 min-w-0 sm:pt-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="font-display text-2xl sm:text-3xl font-bold text-stone-900">
                      {user.firstName} {user.lastName}
                    </h1>
                    <p className="text-stone-500 flex items-center gap-2 mt-1">
                      <Mail className="w-4 h-4 flex-shrink-0" />{user.email}
                    </p>
                  </div>
                  {!isEditing && (
                    <button onClick={() => setIsEditing(true)} className="btn-secondary flex-shrink-0">
                      <Edit2 className="w-4 h-4 mr-2" />Edit
                    </button>
                  )}
                </div>
                
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
                    user.role === 'PROVIDER' ? 'bg-brand-100 text-brand-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    <Briefcase className="w-3.5 h-3.5" />
                    {user.role === 'PROVIDER' ? 'Provider' : 'Client'}
                  </span>
                  {user.roles && user.roles.length > 1 && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-stone-100 text-stone-600">
                      <Shield className="w-3.5 h-3.5" />Dual Role
                    </span>
                  )}
                  {user.city && user.state && (
                    <span className="inline-flex items-center gap-1.5 text-sm text-stone-500">
                      <MapPin className="w-3.5 h-3.5" />{user.city}, {user.state}
                    </span>
                  )}
                  {user.createdAt && (
                    <span className="inline-flex items-center gap-1.5 text-sm text-stone-500">
                      <Calendar className="w-3.5 h-3.5" />
                      Joined {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Save images button */}
            {imagesChanged && (
              <div className="mt-6 pt-4 border-t border-stone-200 flex items-center justify-end gap-3">
                <button onClick={() => { setAvatarPreview(user.avatarUrl || null); setBannerPreview(user.bannerUrl || null); }} className="btn-ghost">Cancel</button>
                <button onClick={handleSaveImages} disabled={savingImages} className="btn-primary">
                  <Save className="w-4 h-4 mr-2" />{savingImages ? 'Saving...' : 'Save Images'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Profile Details Form ─── */}
      <div className="section-padding mt-6">
        <div className="max-w-4xl mx-auto">
          <div className="card p-6 md:p-8">
            {isEditing && (
              <div className="flex items-center justify-end gap-2 mb-6">
                <button onClick={handleCancel} disabled={isSaving} className="btn-ghost"><X className="w-4 h-4 mr-2" />Cancel</button>
                <button onClick={handleSubmit} disabled={isSaving} className="btn-primary"><Save className="w-4 h-4 mr-2" />{isSaving ? 'Saving...' : 'Save Changes'}</button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Personal Information */}
              <div>
                <h3 className="font-display text-lg font-semibold text-stone-900 mb-4 flex items-center gap-2">
                  <UserIcon className="w-5 h-5 text-brand-500" />Personal Information
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">First Name</label>
                    <input type="text" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} disabled={!isEditing} required className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Last Name</label>
                    <input type="text" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} disabled={!isEditing} required className="input-field" />
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div>
                <h3 className="font-display text-lg font-semibold text-stone-900 mb-4 flex items-center gap-2">
                  <Phone className="w-5 h-5 text-brand-500" />Contact Information
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Email</label>
                    <input type="email" value={user.email} disabled className="input-field bg-stone-50 cursor-not-allowed" />
                    <p className="text-xs text-stone-400 mt-1">Email cannot be changed</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Phone Number</label>
                    <input type="tel" value={formData.phoneNumber} onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })} disabled={!isEditing} placeholder="(555) 123-4567" className="input-field" />
                  </div>
                </div>
              </div>

              {/* Address */}
              <div>
                <h3 className="font-display text-lg font-semibold text-stone-900 mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-brand-500" />Address
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Street Address</label>
                    <input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} disabled={!isEditing} placeholder="123 Main St" className="input-field" />
                  </div>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">City</label>
                      <input type="text" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} disabled={!isEditing} placeholder="San Francisco" className="input-field" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">State / Province</label>
                      <input type="text" value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })} disabled={!isEditing} placeholder="CA" className="input-field" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">ZIP / Postal Code</label>
                      <input type="text" value={formData.zipCode} onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })} disabled={!isEditing} placeholder="94102" maxLength={10} className="input-field" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Account Info */}
              <div className="pt-6 border-t border-stone-200">
                <h3 className="font-display text-lg font-semibold text-stone-900 mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-brand-500" />Account Information
                </h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                      <Calendar className="w-4 h-4 text-stone-400" />
                      <span className="text-stone-600">Joined {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                      <Briefcase className="w-4 h-4 text-stone-400" />
                      <span className="text-stone-600">Roles: {user.roles?.join(', ') || user.role}</span>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* ═══════════════ PROVIDER: Menu & Services Section ═══════════════ */}
      {isProvider && (
        <div className="section-padding mt-6">
          <div className="max-w-4xl mx-auto">
            <div className="card p-6 md:p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-display text-xl font-semibold text-stone-900 flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-brand-500" />
                    My Menu & Services
                  </h3>
                  <p className="text-sm text-stone-500 mt-1">
                    Manage the items and services clients can see and order from you.
                    {menuItems.length > 0 && ` ${menuItems.length} item${menuItems.length !== 1 ? 's' : ''} listed.`}
                  </p>
                </div>
                <button onClick={openAddModal} className="btn-primary">
                  <Plus className="w-4 h-4 mr-2" />Add Item
                </button>
              </div>

              {/* Category Filter */}
              {categories.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-4 mb-4">
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
              )}

              {/* Menu Items Grid */}
              {loadingMenu ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand-500 border-t-transparent" />
                </div>
              ) : filteredItems.length > 0 ? (
                <div className="grid md:grid-cols-2 gap-4">
                  {filteredItems.map(item => (
                    <div key={item.id} className={`border border-stone-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow ${!item.isAvailable ? 'opacity-60' : ''}`}>
                      {/* Image */}
                      <div className="h-40 bg-gradient-to-br from-stone-100 to-stone-200 relative">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <ImageIcon className="w-12 h-12 text-stone-300" />
                          </div>
                        )}
                        {!item.isAvailable && (
                          <div className="absolute top-2 left-2 px-2 py-1 bg-red-500 text-white text-xs font-medium rounded-lg">Unavailable</div>
                        )}
                        <div className="absolute top-2 right-2 px-2 py-1 bg-black/50 text-white text-xs rounded-lg backdrop-blur-sm">{item.category}</div>
                      </div>

                      <div className="p-4">
                        <div className="flex items-start justify-between mb-1">
                          <h4 className="font-semibold text-stone-900">{item.name}</h4>
                          <span className="text-lg font-bold text-brand-600 flex-shrink-0 ml-2">${item.price.toFixed(2)}</span>
                        </div>
                        {item.description && <p className="text-sm text-stone-600 mb-2 line-clamp-2">{item.description}</p>}

                        {/* Pricing tiers indicator */}
                        {item.pricingTiers && item.pricingTiers.length > 0 && (
                          <div className="mb-2 p-2 bg-blue-50 rounded-lg">
                            <p className="text-xs font-medium text-blue-700 flex items-center gap-1 mb-1">
                              <Layers className="w-3 h-3" />Quantity pricing available
                            </p>
                            <div className="space-y-0.5">
                              {item.pricingTiers.map((tier, i) => (
                                <p key={i} className="text-xs text-blue-600">
                                  {tier.label}: {tier.minQuantity}{tier.maxQuantity ? `-${tier.maxQuantity}` : '+'} units @ ${tier.pricePerUnit.toFixed(2)}/ea
                                </p>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Tags */}
                        {(item.dietaryInfo.length > 0 || item.allergens.length > 0) && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {item.dietaryInfo.map(info => (
                              <span key={info} className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">{info}</span>
                            ))}
                            {item.allergens.map(a => (
                              <span key={a} className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">⚠ {a}</span>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-2 border-t border-stone-100">
                          <button onClick={() => openEditModal(item)} className="flex-1 btn-ghost text-sm py-1.5 justify-center">
                            <Edit2 className="w-3.5 h-3.5 mr-1" />Edit
                          </button>
                          <button onClick={() => handleDeleteItem(item.id)} disabled={deletingId === item.id}
                            className="flex-1 btn-ghost text-sm py-1.5 text-red-600 hover:bg-red-50 justify-center">
                            <Trash2 className="w-3.5 h-3.5 mr-1" />{deletingId === item.id ? '...' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <ImageIcon className="w-16 h-16 mx-auto mb-3 text-stone-200" />
                  <h4 className="text-lg font-semibold text-stone-700 mb-1">No items yet</h4>
                  <p className="text-stone-500 mb-4 max-w-md mx-auto">
                    Add menu items or service packages so clients can see what you offer.
                  </p>
                  <button onClick={openAddModal} className="btn-primary">
                    <Plus className="w-4 h-4 mr-2" />Add Your First Item
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ Add/Edit Menu Item Modal ═══════════════ */}
      {showMenuModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white rounded-t-2xl border-b border-stone-100 px-6 py-4 flex items-center justify-between z-10">
              <h3 className="font-display text-xl font-bold text-stone-900">
                {editingItem ? 'Edit Item' : 'Add New Item'}
              </h3>
              <button onClick={() => { setShowMenuModal(false); setEditingItem(null); }} className="p-2 hover:bg-stone-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Item Image</label>
                <div className="relative h-48 bg-stone-100 rounded-xl overflow-hidden group cursor-pointer"
                  onClick={() => menuImageInputRef.current?.click()}>
                  {menuImagePreview ? (
                    <img src={menuImagePreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-stone-400">
                      <Camera className="w-10 h-10 mb-2" />
                      <p className="text-sm font-medium">Click to upload image</p>
                    </div>
                  )}
                  <input ref={menuImageInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleMenuImageChange} className="hidden" />
                </div>
                {menuImagePreview && (
                  <button onClick={() => { setMenuImagePreview(null); setMenuFormData(prev => ({ ...prev, imageUrl: null })); }}
                    className="text-sm text-red-600 hover:text-red-700 mt-2">Remove image</button>
                )}
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Item Name *</label>
                <input type="text" value={menuFormData.name}
                  onChange={(e) => setMenuFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Grilled Salmon, Photography Package" className="input-field" />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Description</label>
                <textarea value={menuFormData.description || ''}
                  onChange={(e) => setMenuFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe the item, what's included, etc." rows={3} className="input-field" />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Category *</label>
                <select value={menuFormData.category}
                  onChange={(e) => setMenuFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="input-field">
                  {DEFAULT_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>

              {/* ── Pricing Section ── */}
              <div className="p-4 bg-stone-50 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-stone-700">Pricing</label>
                  <button type="button" onClick={() => {
                    setUseTieredPricing(!useTieredPricing);
                    if (!useTieredPricing && pricingTiers.length === 0) addTier();
                  }}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                      useTieredPricing ? 'bg-blue-500 text-white' : 'bg-stone-200 text-stone-600 hover:bg-stone-300'
                    }`}>
                    <Layers className="w-3 h-3 inline mr-1" />
                    {useTieredPricing ? 'Quantity Pricing ON' : 'Use Quantity Pricing'}
                  </button>
                </div>

                {!useTieredPricing ? (
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Price ($) *</label>
                    <input type="number" value={menuFormData.price || ''}
                      onChange={(e) => setMenuFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                      placeholder="0.00" step="0.01" min="0" className="input-field" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-stone-500">Set different prices based on quantity ordered.</p>
                    {pricingTiers.map((tier, i) => (
                      <div key={i} className="flex items-end gap-2 p-3 bg-white rounded-lg border border-stone-200">
                        <div className="flex-1">
                          <label className="block text-xs text-stone-500 mb-1">Label</label>
                          <input type="text" value={tier.label}
                            onChange={(e) => updateTier(i, 'label', e.target.value)}
                            placeholder="e.g., Small order" className="input-field text-sm py-1.5" />
                        </div>
                        <div className="w-20">
                          <label className="block text-xs text-stone-500 mb-1">Min Qty</label>
                          <input type="number" value={tier.minQuantity}
                            onChange={(e) => updateTier(i, 'minQuantity', parseInt(e.target.value) || 1)}
                            min="1" className="input-field text-sm py-1.5" />
                        </div>
                        <div className="w-20">
                          <label className="block text-xs text-stone-500 mb-1">Max Qty</label>
                          <input type="number" value={tier.maxQuantity || ''}
                            onChange={(e) => updateTier(i, 'maxQuantity', e.target.value ? parseInt(e.target.value) : null)}
                            placeholder="∞" className="input-field text-sm py-1.5" />
                        </div>
                        <div className="w-24">
                          <label className="block text-xs text-stone-500 mb-1">$/unit</label>
                          <input type="number" value={tier.pricePerUnit || ''}
                            onChange={(e) => updateTier(i, 'pricePerUnit', parseFloat(e.target.value) || 0)}
                            step="0.01" min="0" className="input-field text-sm py-1.5" />
                        </div>
                        <button onClick={() => removeTier(i)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg flex-shrink-0">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button onClick={addTier} className="text-sm text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
                      <Plus className="w-4 h-4" />Add Tier
                    </button>
                  </div>
                )}
              </div>

              {/* Dietary Information */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Dietary Information</label>
                <div className="flex flex-wrap gap-2">
                  {DIETARY_OPTIONS.map(option => (
                    <button key={option} type="button" onClick={() => toggleDietaryInfo(option)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        menuFormData.dietaryInfo.includes(option) ? 'bg-green-500 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}>{option}</button>
                  ))}
                </div>
              </div>

              {/* Allergens */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Allergens</label>
                <div className="flex flex-wrap gap-2">
                  {ALLERGEN_OPTIONS.map(option => (
                    <button key={option} type="button" onClick={() => toggleAllergen(option)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        menuFormData.allergens.includes(option) ? 'bg-amber-500 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}>{option}</button>
                  ))}
                </div>
              </div>

              {/* Availability */}
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setMenuFormData(prev => ({ ...prev, isAvailable: !prev.isAvailable }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    menuFormData.isAvailable ? 'bg-green-500' : 'bg-stone-300'
                  }`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    menuFormData.isAvailable ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
                <span className="text-sm text-stone-700">{menuFormData.isAvailable ? 'Available' : 'Unavailable'}</span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white rounded-b-2xl border-t border-stone-100 px-6 py-4 flex gap-3">
              <button onClick={() => { setShowMenuModal(false); setEditingItem(null); }} className="flex-1 btn-ghost">Cancel</button>
              <button onClick={handleSaveItem} disabled={savingItem} className="flex-1 btn-primary">
                <Save className="w-4 h-4 mr-2" />{savingItem ? 'Saving...' : editingItem ? 'Update Item' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
