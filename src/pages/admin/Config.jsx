import { useState, useEffect, useRef } from 'react';
import {
  Settings, Upload, Database, CheckCircle, MessageSquare, Star, Trash2, Plus, Users,
  Store, Tag, Image as ImageIcon, X, Video, Pencil, AlertCircle, KeyRound, Save
} from 'lucide-react';
import { DataService } from '../../services/dataService';
import { VideoPlayer, SafeImage } from '../../components/MediaResolver';
import { autoCropToContent } from '../../utils/imageAutofit';
import { applyFavicon } from '../../utils/favicon';
import { toast } from '../../utils/toast';

// ---------- Utilidades (fuera del componente: puras y estables) ----------

const genId = (prefix) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_PASSWORD = 6;
// Debe coincidir con el fallback de AdminLogin.jsx

const money = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
};

const readSessionUser = () => {
  try {
    const raw = localStorage.getItem('admin_user');
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Sesión corrupta en admin_user:', e);
  }
  return { name: 'Admin Principal', role: 'admin' };
};

const dataURLtoFile = (dataurl, filename) => {
  const [head, body] = dataurl.split(',');
  const mime = head.match(/:(.*?);/)[1];
  const bstr = atob(body);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new File([u8arr], filename, { type: mime });
};

const ROLE_META = {
  admin: { badge: 'badge-primary', label: 'Administrador', desc: 'Puede modificar configuración, productos, usuarios y ver todos los reportes.' },
  employee: { badge: 'badge-success', label: 'Colaborador', desc: 'Puede registrar ventas en caja, gestionar inventario y su propio arqueo.' },
  viewer: { badge: 'badge-warning', label: 'Solo lectura', desc: 'Puede consultar reportes y estadísticas sin modificar nada.' }
};

const PERMISSIONS = [
  ['Dashboard', 'yes', 'yes', 'yes'],
  ['Productos', 'yes', 'yes', 'view'],
  ['Inventario', 'yes', 'yes', 'view'],
  ['Caja / POS', 'yes', 'yes', 'no'],
  ['Clientes', 'yes', 'yes', 'view'],
  ['Reportes', 'yes', 'yes', 'yes'],
  ['Configuración', 'yes', 'no', 'no'],
  ['Usuarios', 'yes', 'no', 'no']
];
const PERM_BADGE = {
  yes: <span className="badge badge-success">Sí</span>,
  view: <span className="badge badge-info">Ver</span>,
  no: <span className="badge">No</span>
};

const TABS = [
  { id: 'general', label: 'Tienda', icon: Store },
  { id: 'hero', label: 'Portada', icon: ImageIcon },
  { id: 'wholesale', label: 'Ofertas', icon: Tag },
  { id: 'videos', label: 'Videos', icon: Video },
  { id: 'reviews', label: 'Testimonios', icon: MessageSquare },
  { id: 'footer', label: 'Footer', icon: Settings },
  { id: 'users', label: 'Usuarios', icon: Users },
  { id: 'database', label: 'Base de datos', icon: Database }
];

const CROP_W = 1600;
const CROP_H = 900;

// ---------- Subcomponentes a nivel de módulo ----------

function SectionTitle({ icon: Icon, title, desc, right }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          {Icon && <Icon size={18} style={{ color: 'var(--color-primary)' }} />}
          {title}
        </h3>
        {desc && <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{desc}</p>}
      </div>
      {right}
    </div>
  );
}

function UploadBox({ label, hint, preview, previewStyle, uploading, onChange, emptyText, changeText, dark = false }) {
  return (
    <div>
      <span className="field-label">{label}</span>
      <label style={{
        border: `1px ${preview ? 'solid' : 'dashed'} var(--border-strong)`,
        borderRadius: 'var(--radius)',
        padding: 16,
        background: dark ? '#0F172A' : 'var(--bg-subtle)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        cursor: uploading ? 'wait' : 'pointer',
        minHeight: 120, justifyContent: 'center', textAlign: 'center'
      }}>
        <input type="file" accept="image/*" onChange={onChange} disabled={uploading} style={{ display: 'none' }} />
        {preview && <img src={preview} alt={label} style={previewStyle} />}
        <span className="btn-secondary btn-sm" style={{ pointerEvents: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {uploading ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <Upload size={14} />}
          {uploading ? 'Subiendo…' : preview ? changeText : emptyText}
        </span>
      </label>
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

function Field({ label, children, hint }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      {children}
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

function SaveButton({ saving, saveKey, children }) {
  const mine = saving === saveKey;
  return (
    <button type="submit" className="btn-primary" disabled={!!saving} style={{ alignSelf: 'flex-end', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      {mine ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <Save size={16} />}
      {mine ? 'Guardando…' : children}
    </button>
  );
}

const grid = (min) => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${min}px), 1fr))`, gap: 16 });
const stack = (gap = 16) => ({ display: 'flex', flexDirection: 'column', gap });

// ---------- Componente principal ----------

export default function Config() {
  const [currentUser] = useState(readSessionUser);

  const [activeTab, setActiveTab] = useState('general');
  const [config, setConfig] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [products, setProducts] = useState([]);
  // Clave de la acción que se está guardando (deshabilita botones y evita dobles envíos)
  const [saving, setSaving] = useState(null);

  const [logoUploading, setLogoUploading] = useState(false);
  const [favUploading, setFavUploading] = useState(false);
  const [heroUploading, setHeroUploading] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);

  const [newVideo, setNewVideo] = useState({ title: '', desc: '', url: '' });
  const [newReview, setNewReview] = useState({ name: '', stars: 5, comment: '' });
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'employee', password: '' });
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [pwdUser, setPwdUser] = useState(null); // usuario al que se le restablece la contraseña
  const [pwdValue, setPwdValue] = useState('');
  const [userErrors, setUserErrors] = useState({});

  // Cropper del slider
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [editingIdx, setEditingIdx] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageRef = useRef(null);
  const cropBoxRef = useRef(null);

  // Cambio de contraseña (colaboradores)
  const [empPasswordForm, setEmpPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [empError, setEmpError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([DataService.getConfig(), DataService.getProducts()])
      .then(([cfg, prods]) => {
        if (!active) return;
        setConfig(cfg);
        setProducts(prods || []);
      })
      .catch(err => {
        console.error(err);
        if (active) setLoadError('No se pudo cargar la configuración. Revisa tu conexión e intenta de nuevo.');
      });
    return () => { active = false; };
  }, []);

  /**
   * Guarda la configuración completa. Aplica el cambio en pantalla de inmediato y,
   * si Supabase lo rechaza, revierte al estado anterior y muestra el error.
   */
  const persist = async (updatedConfig, { key = 'config', success = 'Cambios guardados', log } = {}) => {
    const previous = config;
    setConfig(updatedConfig);
    setSaving(key);
    try {
      await DataService.saveConfig(updatedConfig);
      if (log) {
        try { await DataService.addActionLog(log, currentUser.name); } catch (e) { console.error(e); }
      }
      if (success) toast.success(success);
      return true;
    } catch (err) {
      console.error(err);
      setConfig(previous);
      toast.error(err?.message || 'No se pudo guardar la configuración.');
      return false;
    } finally {
      setSaving(null);
    }
  };

  const handleTextChange = (field, val) => setConfig(prev => ({ ...prev, [field]: val }));
  const handleFooterChange = (field, val) => setConfig(prev => ({ ...prev, footer: { ...(prev.footer || {}), [field]: val } }));

  const handleSave = async (e, key = 'config') => {
    if (e) e.preventDefault();
    if (saving) return;
    await persist(config, { key, success: 'Ajustes guardados y aplicados a la tienda', log: 'Actualizó la configuración de la tienda' });
  };

  // --- Colaborador: cambio de contraseña ---
  const handleChangeEmployeePassword = async (e) => {
    e.preventDefault();
    if (saving) return;
    setEmpError('');

    if (empPasswordForm.newPassword.length < MIN_PASSWORD) { setEmpError(`La nueva contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`); return; }
    if (empPasswordForm.newPassword !== empPasswordForm.confirmPassword) { setEmpError('Las nuevas contraseñas no coinciden.'); return; }

    setSaving('emp-password');
    try {
      await DataService.changeOwnPassword(empPasswordForm.oldPassword, empPasswordForm.newPassword);
      DataService.addActionLog('Cambió su contraseña de acceso', currentUser.name);
      toast.success('Contraseña actualizada');
      setEmpPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setEmpError(err.message);
    } finally {
      setSaving(null);
    }
  };

  // --- Logo / favicon ---
  // field: 'storeLogoUrl' (fondos claros) | 'storeLogoDarkUrl' (fondos oscuros)
  const handleUploadLogo = (field) => async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLogoUploading(field);
    try {
      const optimized = await autoCropToContent(file); // recorta márgenes vacíos
      const url = await DataService.uploadImage(optimized);
      const which = field === 'storeLogoDarkUrl' ? 'para fondos oscuros' : 'para fondos claros';
      await persist({ ...config, [field]: url }, { key: 'logo', success: `Logo ${which} actualizado`, log: `Actualizó el logo ${which}` });
    } catch (err) {
      console.error(err);
      toast.error('No se pudo subir el logo.');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleRemoveLogo = (field) => {
    if (!window.confirm('¿Quitar este logo?')) return;
    persist({ ...config, [field]: '' }, { key: 'logo', success: 'Logo quitado', log: 'Quitó un logo de la tienda' });
  };

  const handleUploadFavicon = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setFavUploading(true);
    try {
      const optimized = await autoCropToContent(file, { paddingRatio: 0.04 });
      const url = await DataService.uploadImage(optimized);
      const ok = await persist({ ...config, storeFaviconUrl: url }, { key: 'favicon', success: 'Favicon actualizado', log: 'Actualizó el favicon de la tienda' });
      if (ok) applyFavicon(url);
    } catch (err) {
      console.error(err);
      toast.error('No se pudo subir el favicon.');
    } finally {
      setFavUploading(false);
    }
  };

  // --- Slider de portada ---
  const openCropper = (file, idx) => {
    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(reader.result);
      setEditingIdx(idx);
      setCropZoom(1);
      setCropOffset({ x: 0, y: 0 });
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadHeroImage = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) openCropper(file, null);
  };

  const handleEditHeroImage = (e, idx) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) openCropper(file, idx);
  };

  const handleRemoveHeroImage = (idx) => {
    if (!window.confirm('¿Eliminar esta imagen del slider?')) return;
    const heroImages = (config.heroImages || []).filter((_, i) => i !== idx);
    persist({ ...config, heroImages }, { key: 'hero', success: 'Imagen eliminada del slider' });
  };

  const closeCropper = () => {
    setShowCropModal(false);
    setCropImageSrc(null);
    setCropZoom(1);
    setCropOffset({ x: 0, y: 0 });
    setEditingIdx(null);
  };

  const handleDragStart = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - cropOffset.x, y: e.clientY - cropOffset.y });
  };
  const handleDragMove = (e) => {
    if (!isDragging) return;
    setCropOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const handleDragEnd = () => setIsDragging(false);
  const handleTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    setIsDragging(true);
    setDragStart({ x: e.touches[0].clientX - cropOffset.x, y: e.touches[0].clientY - cropOffset.y });
  };
  const handleTouchMove = (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    setCropOffset({ x: e.touches[0].clientX - dragStart.x, y: e.touches[0].clientY - dragStart.y });
  };

  const handleCropSave = async () => {
    const imgElement = imageRef.current;
    const box = cropBoxRef.current;
    if (!imgElement || !box) return;

    setHeroUploading(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = CROP_W;
      canvas.height = CROP_H;
      const ctx = canvas.getContext('2d');

      // Tamaño real del recuadro en pantalla (es responsivo)
      const cw = box.clientWidth || 480;
      const ch = box.clientHeight || 270;

      const imgWidth = imgElement.naturalWidth || imgElement.width || CROP_W;
      const imgHeight = imgElement.naturalHeight || imgElement.height || CROP_H;
      const imgAspect = imgWidth / imgHeight;

      let previewWidth, previewHeight;
      if (imgAspect > cw / ch) {
        previewWidth = cw;
        previewHeight = cw / imgAspect;
      } else {
        previewHeight = ch;
        previewWidth = ch * imgAspect;
      }

      const scaleToCanvas = CROP_W / cw;
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const drawWidth = previewWidth * cropZoom * scaleToCanvas;
      const drawHeight = previewHeight * cropZoom * scaleToCanvas;
      ctx.save();
      ctx.translate(canvas.width / 2 + cropOffset.x * scaleToCanvas, canvas.height / 2 + cropOffset.y * scaleToCanvas);
      ctx.drawImage(imgElement, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      ctx.restore();

      const fileObj = dataURLtoFile(canvas.toDataURL('image/jpeg', 0.9), 'cropped_slider.jpg');
      const url = await DataService.uploadImage(fileObj);

      const heroImages = [...(config.heroImages || [])];
      const isEdit = editingIdx !== null;
      if (isEdit) heroImages[editingIdx] = url;
      else heroImages.push(url);

      closeCropper();
      await persist({ ...config, heroImages }, { key: 'hero', success: isEdit ? 'Imagen del slider reemplazada' : 'Imagen añadida al slider' });
    } catch (err) {
      console.error(err);
      toast.error('Error al guardar la imagen recortada.');
    } finally {
      setHeroUploading(false);
    }
  };

  // --- Ofertas ---
  const handleToggleOfferSelection = (productId) => {
    if (saving) return;
    const current = config.selectedOffers || [];
    const selectedOffers = current.includes(productId) ? current.filter(id => id !== productId) : [...current, productId];
    persist({ ...config, selectedOffers }, { key: 'offers', success: 'Carrusel de ofertas actualizado' });
  };

  // --- Videos ---
  const handleUploadVideoFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setVideoUploading(true);
    try {
      const url = await DataService.uploadImage(file);
      setNewVideo(prev => ({ ...prev, url }));
      toast.success('Video subido. Completa el título y añádelo.');
    } catch (err) {
      console.error(err);
      toast.error('No se pudo subir el video.');
    } finally {
      setVideoUploading(false);
    }
  };

  const handleAddVideo = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!newVideo.title.trim() || !newVideo.url.trim()) {
      toast.warning('Ingresa un título y sube un video o pega su URL.');
      return;
    }
    const videoItem = { id: genId('v'), title: newVideo.title.trim(), desc: newVideo.desc.trim(), url: newVideo.url.trim() };
    const ok = await persist({ ...config, videos: [...(config.videos || []), videoItem] }, { key: 'video-add', success: 'Video añadido a la pasarela' });
    if (ok) setNewVideo({ title: '', desc: '', url: '' });
  };

  const handleDeleteVideo = (id) => {
    if (!window.confirm('¿Eliminar este video?')) return;
    persist({ ...config, videos: (config.videos || []).filter(v => v.id !== id) }, { key: 'video-del', success: 'Video eliminado' });
  };

  // --- Testimonios ---
  const handleAddReview = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!newReview.name.trim() || !newReview.comment.trim()) {
      toast.warning('Completa el nombre y el comentario.');
      return;
    }
    const review = {
      id: genId('t'),
      name: newReview.name.trim(),
      stars: Math.min(5, Math.max(1, parseInt(newReview.stars, 10) || 5)),
      comment: newReview.comment.trim(),
      date: new Date().toLocaleDateString('en-CA') // YYYY-MM-DD en hora local
    };
    const ok = await persist({ ...config, testimonials: [...(config.testimonials || []), review] }, { key: 'review-add', success: 'Testimonio añadido' });
    if (ok) setNewReview({ name: '', stars: 5, comment: '' });
  };

  const handleDeleteReview = (id) => {
    if (!window.confirm('¿Eliminar este testimonio?')) return;
    persist({ ...config, testimonials: (config.testimonials || []).filter(t => t.id !== id) }, { key: 'review-del', success: 'Testimonio eliminado' });
  };

  // --- Usuarios (Supabase Auth + tabla profiles) ---
  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      setUsers(await DataService.listUsers());
      setUsersLoaded(true);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'users' && !usersLoaded && currentUser.role === 'admin') {
      loadUsers(); // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const validateNewUser = () => {
    const errs = {};
    const email = newUser.email.trim().toLowerCase();
    if (!newUser.name.trim()) errs.name = 'Ingresa el nombre.';
    if (!EMAIL_RE.test(email)) errs.email = 'Ingresa un correo válido (ej. nombre@dominio.com).';
    else if (users.some(u => (u.email || '').toLowerCase() === email)) errs.email = 'Ya existe un usuario con este correo.';
    if (newUser.password.length < MIN_PASSWORD) errs.password = `Mínimo ${MIN_PASSWORD} caracteres.`;
    return errs;
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (saving) return;
    const errs = validateNewUser();
    setUserErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving('user-add');
    try {
      const created = await DataService.createUser({
        name: newUser.name.trim(),
        email: newUser.email.trim().toLowerCase(),
        password: newUser.password,
        role: newUser.role
      });
      setUsers(prev => [...prev, created]);
      DataService.addActionLog(`Agregó al usuario "${created.name}" (Rol: ${created.role})`, currentUser.name);
      toast.success(`Usuario "${created.name}" creado. Ya puede iniciar sesión.`);
      setNewUser({ name: '', email: '', role: 'employee', password: '' });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(null);
    }
  };

  const activeAdmins = users.filter(u => u.role === 'admin' && u.active).length;

  const handleUpdateUser = async (user, patch, successMsg, logMsg) => {
    if (saving) return;
    const losesAdmin = user.role === 'admin' && user.active && (patch.active === false || (patch.role && patch.role !== 'admin'));
    if (losesAdmin && activeAdmins <= 1) {
      toast.warning('Debe quedar al menos un administrador activo.');
      return;
    }
    setSaving(`user-${user.id}`);
    try {
      const updated = await DataService.updateUser(user.id, patch);
      setUsers(prev => prev.map(u => (u.id === user.id ? { ...u, ...updated } : u)));
      DataService.addActionLog(logMsg, currentUser.name);
      toast.success(successMsg);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(null);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (saving || !pwdUser) return;
    if (pwdValue.length < MIN_PASSWORD) { toast.warning(`Mínimo ${MIN_PASSWORD} caracteres.`); return; }
    setSaving(`pwd-${pwdUser.id}`);
    try {
      await DataService.setUserPassword(pwdUser.id, pwdValue);
      DataService.addActionLog(`Restableció la contraseña de "${pwdUser.name}"`, currentUser.name);
      toast.success(`Contraseña de "${pwdUser.name}" actualizada`);
      setPwdUser(null);
      setPwdValue('');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(null);
    }
  };

  const handleToggleActive = (user) => {
    if (user.id === currentUser.id) { toast.warning('No puedes desactivar tu propio usuario.'); return; }
    if (user.active && !window.confirm(`¿Desactivar a "${user.name}"? Perderá el acceso al panel de inmediato.`)) return;
    handleUpdateUser(
      user,
      { active: !user.active },
      user.active ? 'Usuario desactivado' : 'Usuario activado',
      `${user.active ? 'Desactivó' : 'Activó'} al usuario "${user.name}"`
    );
  };

  const handleChangeRole = (user, role) => {
    if (role === user.role) return;
    handleUpdateUser(user, { role }, 'Rol actualizado', `Cambió el rol de "${user.name}" a ${role}`);
  };

  // ---------- Render ----------

  if (loadError) {
    return (
      <div className="card empty-state">
        <AlertCircle size={32} style={{ color: 'var(--color-danger)' }} />
        <h3>Error al cargar</h3>
        <p>{loadError}</p>
        <button className="btn-primary" onClick={() => window.location.reload()}>Reintentar</button>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="empty-state" style={{ minHeight: 320, justifyContent: 'center' }}>
        <div className="spinner" />
        <p>Cargando configuración…</p>
      </div>
    );
  }

  const isSaving = (key) => saving === key;

  if (currentUser.role === 'employee') {
    return (
      <div style={{ maxWidth: 480, margin: '24px auto', width: '100%' }}>
        <div className="page-header">
          <div>
            <h1>Mi perfil</h1>
            <p>Cambia tu contraseña de acceso a la caja y al panel.</p>
          </div>
        </div>
        <form onSubmit={handleChangeEmployeePassword} className="card" style={stack(16)}>
          <SectionTitle icon={KeyRound} title="Cambiar contraseña" />
          {empError && <div className="alert alert-danger"><AlertCircle size={16} /> {empError}</div>}
          <Field label="Contraseña actual">
            <input type="password" required autoComplete="current-password" className="input-field"
              value={empPasswordForm.oldPassword} onChange={e => setEmpPasswordForm({ ...empPasswordForm, oldPassword: e.target.value })} />
          </Field>
          <Field label="Nueva contraseña" hint={`Mínimo ${MIN_PASSWORD} caracteres.`}>
            <input type="password" required minLength={MIN_PASSWORD} autoComplete="new-password" className="input-field"
              value={empPasswordForm.newPassword} onChange={e => setEmpPasswordForm({ ...empPasswordForm, newPassword: e.target.value })} />
          </Field>
          <Field label="Confirmar nueva contraseña">
            <input type="password" required autoComplete="new-password" className="input-field"
              value={empPasswordForm.confirmPassword} onChange={e => setEmpPasswordForm({ ...empPasswordForm, confirmPassword: e.target.value })} />
          </Field>
          <button type="submit" className="btn-primary btn-block" disabled={isSaving('emp-password')}>
            {isSaving('emp-password') ? 'Guardando…' : 'Actualizar contraseña'}
          </button>
        </form>
      </div>
    );
  }

  const offerProducts = products.filter(p => p.offer_price != null || p.wholesale_price != null);
  const supabaseOn = DataService.isSupabaseEnabled();

  return (
    <div style={stack(20)}>
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1>Configuración</h1>
          <p>Personaliza la tienda, la portada, el contenido público y el acceso del equipo.</p>
        </div>
      </div>

      <div className="tabs" role="tablist">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" role="tab" aria-selected={activeTab === id}
            className={`tab${activeTab === id ? ' active' : ''}`}
            onClick={() => setActiveTab(id)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* TIENDA */}
      {activeTab === 'general' && (
        <form onSubmit={e => handleSave(e, 'general')} style={stack(20)}>
          <div className="card" style={stack(16)}>
            <SectionTitle icon={Store} title="Identidad de marca" desc="Logo, ícono y nombre que verán tus clientes." />
            <div style={grid(220)}>
              <div>
                <UploadBox label="Logo para fondos claros" preview={config.storeLogoUrl}
                  previewStyle={{ maxHeight: 80, maxWidth: '100%', objectFit: 'contain' }}
                  uploading={logoUploading === 'storeLogoUrl'} onChange={handleUploadLogo('storeLogoUrl')}
                  emptyText="Subir logo oscuro" changeText="Cambiar logo"
                  hint="Versión oscura del logo, PNG sin fondo. Se usa en la tienda, el ticket y la boleta impresa." />
                {config.storeLogoUrl && <button type="button" className="btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => handleRemoveLogo('storeLogoUrl')}>Quitar</button>}
              </div>
              <div>
                <UploadBox label="Logo para fondos oscuros" preview={config.storeLogoDarkUrl} dark
                  previewStyle={{ maxHeight: 80, maxWidth: '100%', objectFit: 'contain' }}
                  uploading={logoUploading === 'storeLogoDarkUrl'} onChange={handleUploadLogo('storeLogoDarkUrl')}
                  emptyText="Subir logo blanco" changeText="Cambiar logo"
                  hint="Versión blanca del logo, PNG sin fondo. Se usa en el menú del panel, el pie de la tienda y la cabecera de boletas y facturas." />
                {config.storeLogoDarkUrl && <button type="button" className="btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => handleRemoveLogo('storeLogoDarkUrl')}>Quitar</button>}
              </div>
              <UploadBox label="Favicon del sitio" preview={config.storeFaviconUrl}
                previewStyle={{ width: 40, height: 40, objectFit: 'contain' }}
                uploading={favUploading} onChange={handleUploadFavicon}
                emptyText="Subir favicon" changeText="Cambiar favicon"
                hint="Ícono de la pestaña del navegador (32×32 px)." />
            </div>
            <Field label="Nombre comercial">
              <input type="text" className="input-field" value={config.storeName || ''} onChange={e => handleTextChange('storeName', e.target.value)} />
            </Field>
            <Field label="Cinta superior (anuncio)" hint="Texto corto que aparece en la franja superior de la tienda.">
              <input type="text" className="input-field" value={config.bannerText || ''} onChange={e => handleTextChange('bannerText', e.target.value)} />
            </Field>
          </div>

          <div className="card" style={stack(16)}>
            <SectionTitle icon={Settings} title="Datos del emisor" desc="Aparecen en tickets, boletas y facturas." />
            <div style={grid(240)}>
              <Field label="Razón social / nombre legal">
                <input type="text" className="input-field" value={config.businessName || ''} onChange={e => handleTextChange('businessName', e.target.value)} placeholder="Ej. CARRILLO STORE S.A.C." />
              </Field>
              <Field label="R.U.C.">
                <input type="text" inputMode="numeric" maxLength={11} className="input-field" value={config.ruc || ''} onChange={e => handleTextChange('ruc', e.target.value.replace(/\D/g, ''))} placeholder="Ej. 20601234567" />
              </Field>
            </div>
            <Field label="Dirección fiscal">
              <input type="text" className="input-field" value={config.fiscalAddress || ''} onChange={e => handleTextChange('fiscalAddress', e.target.value)} placeholder="Ej. Av. Larco 123, Miraflores, Lima" />
            </Field>
            <div style={grid(240)}>
              <Field label="Teléfono en ticket">
                <input type="tel" className="input-field" value={config.ticketPhone || ''} onChange={e => handleTextChange('ticketPhone', e.target.value)} placeholder="Ej. +51 987 654 321" />
              </Field>
              <Field label="Email en ticket">
                <input type="email" className="input-field" value={config.ticketEmail || ''} onChange={e => handleTextChange('ticketEmail', e.target.value)} placeholder="Ej. ventas@carrillostore.com" />
              </Field>
            </div>
            <SaveButton saving={saving} saveKey="general">Guardar cambios</SaveButton>
          </div>
        </form>
      )}

      {/* PORTADA */}
      {activeTab === 'hero' && (
        <div style={{ ...grid(320), alignItems: 'start' }}>
          <form onSubmit={e => handleSave(e, 'hero-text')} className="card" style={stack(16)}>
            <SectionTitle icon={Pencil} title="Textos de portada" desc="Título y subtítulo del banner principal." />
            <Field label="Título del banner">
              <input type="text" className="input-field" value={config.heroTitle || ''} onChange={e => handleTextChange('heroTitle', e.target.value)} />
            </Field>
            <Field label="Subtítulo">
              <textarea className="input-field" rows={3} value={config.heroSubtitle || ''} onChange={e => handleTextChange('heroSubtitle', e.target.value)} />
            </Field>
            <SaveButton saving={saving} saveKey="hero-text">Guardar textos</SaveButton>
          </form>

          <div className="card" style={stack(16)}>
            <SectionTitle icon={ImageIcon} title={`Imágenes del slider (${config.heroImages?.length || 0})`}
              desc="Sube una imagen y ajústala al formato 16:9 antes de publicarla." />
            <label style={{
              border: '2px dashed var(--border-strong)', borderRadius: 'var(--radius-lg)', padding: 24,
              textAlign: 'center', background: 'var(--bg-subtle)', cursor: heroUploading ? 'wait' : 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6
            }}>
              <input type="file" accept="image/*" onChange={handleUploadHeroImage} disabled={heroUploading} style={{ display: 'none' }} />
              {heroUploading ? <span className="spinner" /> : <Upload size={24} style={{ color: 'var(--text-secondary)' }} />}
              <strong style={{ fontSize: 14 }}>{heroUploading ? 'Subiendo imagen…' : 'Cargar nueva imagen'}</strong>
              <span className="field-hint" style={{ marginTop: 0 }}>PNG, JPG o WEBP hasta 5 MB</span>
            </label>

            {(config.heroImages || []).length === 0 ? (
              <div className="empty-state" style={{ padding: 24 }}>
                <ImageIcon size={28} style={{ opacity: 0.4 }} />
                <p>Aún no hay imágenes en el slider.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
                {config.heroImages.map((url, idx) => (
                  <div key={`${url}-${idx}`} style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', overflow: 'hidden', background: 'var(--bg-card)', boxShadow: 'var(--shadow-xs)' }}>
                    <div style={{ aspectRatio: '16 / 9', background: '#111' }}>
                      <SafeImage src={url} alt={`Slide ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>#{idx + 1}</span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <label className="btn-ghost btn-icon btn-sm" title="Reemplazar imagen" style={{ cursor: 'pointer', width: 30, height: 30, minHeight: 30 }}>
                          <input type="file" accept="image/*" onChange={e => handleEditHeroImage(e, idx)} style={{ display: 'none' }} />
                          <Pencil size={14} />
                        </label>
                        <button type="button" className="btn-ghost btn-icon btn-sm" title="Eliminar imagen" disabled={!!saving}
                          onClick={() => handleRemoveHeroImage(idx)} style={{ color: 'var(--color-danger)', width: 30, height: 30, minHeight: 30 }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* OFERTAS */}
      {activeTab === 'wholesale' && (
        <div className="card" style={stack(16)}>
          <SectionTitle icon={Tag} title="Ofertas en el carrusel de inicio"
            desc="Se listan los productos con precio de oferta o precio por mayor. Marca los que quieres destacar; se guarda al instante."
            right={<span className="badge badge-primary">{(config.selectedOffers || []).length} destacados</span>} />

          {offerProducts.length === 0 ? (
            <div className="empty-state">
              <Tag size={32} style={{ opacity: 0.4 }} />
              <h3>Sin productos en oferta</h3>
              <p>Agrega un precio de oferta o por mayor a tus productos desde el catálogo.</p>
            </div>
          ) : (
            <div style={stack(10)}>
              {offerProducts.map(p => {
                const isSelected = !!config.selectedOffers?.includes(p.id);
                return (
                  <label key={p.id} style={{
                    padding: 12, border: `1px solid ${isSelected ? 'var(--color-primary)' : 'var(--border-color)'}`,
                    borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                    background: isSelected ? 'var(--color-primary-soft)' : 'var(--bg-card)',
                    cursor: saving ? 'wait' : 'pointer', transition: 'var(--transition-fast)'
                  }}>
                    <input type="checkbox" checked={isSelected} disabled={!!saving}
                      onChange={() => handleToggleOfferSelection(p.id)} style={{ width: 18, height: 18 }} />
                    <SafeImage src={p.image_url} alt={p.name} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }} />
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <strong style={{ fontSize: 14, display: 'block' }}>{p.name}</strong>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                        <span>Normal: S/. {money(p.price)}</span>
                        {p.offer_price != null && <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>Oferta: S/. {money(p.offer_price)}</span>}
                        {p.wholesale_price != null && <span style={{ color: 'var(--color-info)', fontWeight: 600 }}>Mayorista: S/. {money(p.wholesale_price)} (mín. {p.wholesale_min_qty || 6} uds)</span>}
                      </div>
                    </div>
                    <span className={`badge ${isSelected ? 'badge-primary' : ''}`}>{isSelected ? 'Destacado' : 'Oculto'}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIDEOS */}
      {activeTab === 'videos' && (
        <div style={{ ...grid(320), alignItems: 'start' }}>
          <form onSubmit={handleAddVideo} className="card" style={stack(16)}>
            <SectionTitle icon={Video} title="Añadir video" desc="Videos cortos de modelos que se muestran en la pasarela de inicio." />
            <Field label="Título del video">
              <input type="text" required placeholder="Ej. Polo Oversize Charcoal en exterior" className="input-field" value={newVideo.title} onChange={e => setNewVideo({ ...newVideo, title: e.target.value })} />
            </Field>
            <Field label="Descripción corta">
              <input type="text" placeholder="Ej. Algodón pesado de 240 g" className="input-field" value={newVideo.desc} onChange={e => setNewVideo({ ...newVideo, desc: e.target.value })} />
            </Field>
            <div>
              <span className="field-label">Archivo de video</span>
              <label style={{ border: '1px dashed var(--border-strong)', borderRadius: 'var(--radius)', padding: 16, textAlign: 'center', background: 'var(--bg-subtle)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: videoUploading ? 'wait' : 'pointer' }}>
                <input type="file" accept="video/*" onChange={handleUploadVideoFile} disabled={videoUploading} style={{ display: 'none' }} />
                {videoUploading ? <span className="spinner" style={{ width: 20, height: 20 }} /> : <Upload size={18} style={{ color: 'var(--text-secondary)' }} />}
                <span style={{ fontSize: 13, fontWeight: 500 }}>{videoUploading ? 'Subiendo video…' : 'Selecciona un .mp4 o .webm'}</span>
              </label>
            </div>
            <Field label="O pega una URL directa">
              <input type="url" placeholder="https://…" className="input-field" value={newVideo.url} onChange={e => setNewVideo({ ...newVideo, url: e.target.value })} />
            </Field>
            <button type="submit" className="btn-primary" disabled={!!saving || videoUploading} style={{ display: 'inline-flex', gap: 8, justifyContent: 'center' }}>
              <Plus size={16} /> {isSaving('video-add') ? 'Guardando…' : 'Añadir video'}
            </button>
          </form>

          <div className="card" style={stack(16)}>
            <SectionTitle title={`Videos publicados (${config.videos?.length || 0})`} />
            {(config.videos || []).length === 0 ? (
              <div className="empty-state"><Video size={32} style={{ opacity: 0.4 }} /><p>Aún no hay videos en la pasarela.</p></div>
            ) : (
              <div style={{ ...stack(10), maxHeight: 520, overflowY: 'auto' }}>
                {config.videos.map(v => (
                  <div key={v.id} style={{ padding: 12, border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ width: 72, height: 100, flexShrink: 0, background: '#000', overflow: 'hidden', borderRadius: 'var(--radius-sm)' }}>
                      <VideoPlayer url={v.url} title={v.title} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ fontSize: 14, display: 'block' }}>{v.title}</strong>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v.desc || 'Sin descripción'}</span>
                    </div>
                    <button type="button" className="btn-ghost btn-icon" title="Eliminar video" disabled={!!saving}
                      onClick={() => handleDeleteVideo(v.id)} style={{ color: 'var(--color-danger)' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TESTIMONIOS */}
      {activeTab === 'reviews' && (
        <div style={{ ...grid(320), alignItems: 'start' }}>
          <form onSubmit={handleAddReview} className="card" style={stack(16)}>
            <SectionTitle icon={MessageSquare} title="Añadir testimonio" desc="Opiniones de clientes que aparecen en la tienda." />
            <Field label="Nombre del cliente">
              <input type="text" required placeholder="Ej. Valeria M." className="input-field" value={newReview.name} onChange={e => setNewReview({ ...newReview, name: e.target.value })} />
            </Field>
            <Field label="Calificación">
              <select className="input-field" value={newReview.stars} onChange={e => setNewReview({ ...newReview, stars: e.target.value })}>
                {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{'★'.repeat(n)} ({n})</option>)}
              </select>
            </Field>
            <Field label="Comentario">
              <textarea required placeholder="Escribe aquí el testimonio…" className="input-field" rows={4} value={newReview.comment} onChange={e => setNewReview({ ...newReview, comment: e.target.value })} />
            </Field>
            <button type="submit" className="btn-primary" disabled={!!saving} style={{ display: 'inline-flex', gap: 8, justifyContent: 'center' }}>
              <Plus size={16} /> {isSaving('review-add') ? 'Guardando…' : 'Añadir testimonio'}
            </button>
          </form>

          <div className="card" style={stack(16)}>
            <SectionTitle title={`Testimonios activos (${config.testimonials?.length || 0})`} />
            {(config.testimonials || []).length === 0 ? (
              <div className="empty-state"><MessageSquare size={32} style={{ opacity: 0.4 }} /><p>Aún no hay testimonios.</p></div>
            ) : (
              <div style={{ ...stack(10), maxHeight: 520, overflowY: 'auto' }}>
                {config.testimonials.map(t => {
                  const stars = Math.min(5, Math.max(0, parseInt(t.stars, 10) || 0));
                  return (
                    <div key={t.id} style={{ padding: 14, border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 2, marginBottom: 6 }}>
                          {Array.from({ length: 5 }, (_, i) => (
                            <Star key={i} size={13} fill={i < stars ? '#F59E0B' : 'none'} stroke={i < stars ? 'none' : 'var(--border-strong)'} />
                          ))}
                        </div>
                        <strong style={{ fontSize: 14 }}>{t.name}</strong>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, fontStyle: 'italic' }}>“{t.comment}”</p>
                      </div>
                      <button type="button" className="btn-ghost btn-icon" title="Eliminar testimonio" disabled={!!saving}
                        onClick={() => handleDeleteReview(t.id)} style={{ color: 'var(--color-danger)', flexShrink: 0 }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* FOOTER */}
      {activeTab === 'footer' && (
        <form onSubmit={e => handleSave(e, 'footer')} className="card" style={{ ...stack(16), maxWidth: 720 }}>
          <SectionTitle icon={Settings} title="Contacto y redes sociales" desc="Datos que se muestran en el pie de página de la tienda." />
          <div style={grid(220)}>
            <Field label="WhatsApp de soporte">
              <input type="tel" className="input-field" value={config.footer?.whatsapp || ''} onChange={e => handleFooterChange('whatsapp', e.target.value)} placeholder="Ej. 51987654321" />
            </Field>
            <Field label="Email corporativo">
              <input type="email" className="input-field" value={config.footer?.email || ''} onChange={e => handleFooterChange('email', e.target.value)} />
            </Field>
          </div>
          <Field label="Dirección de tienda física">
            <input type="text" className="input-field" value={config.footer?.address || ''} onChange={e => handleFooterChange('address', e.target.value)} />
          </Field>
          <div style={grid(180)}>
            <Field label="Facebook URL">
              <input type="url" className="input-field" value={config.footer?.facebookUrl || ''} onChange={e => handleFooterChange('facebookUrl', e.target.value)} placeholder="https://facebook.com/…" />
            </Field>
            <Field label="Instagram URL">
              <input type="url" className="input-field" value={config.footer?.instagramUrl || ''} onChange={e => handleFooterChange('instagramUrl', e.target.value)} placeholder="https://instagram.com/…" />
            </Field>
            <Field label="TikTok URL">
              <input type="url" className="input-field" value={config.footer?.tiktokUrl || ''} onChange={e => handleFooterChange('tiktokUrl', e.target.value)} placeholder="https://tiktok.com/@…" />
            </Field>
          </div>
          <SaveButton saving={saving} saveKey="footer">Guardar contacto y redes</SaveButton>
        </form>
      )}

      {/* USUARIOS */}
      {activeTab === 'users' && (
        <div style={{ ...grid(320), alignItems: 'start' }}>
          <form onSubmit={handleAddUser} noValidate className="card" style={stack(14)}>
            <SectionTitle icon={Users} title="Nuevo usuario" desc="Da acceso al panel a un colaborador y asígnale un rol." />
            <Field label="Nombre completo *">
              <input type="text" className="input-field" placeholder="Ej. María López" value={newUser.name}
                onChange={e => setNewUser(prev => ({ ...prev, name: e.target.value }))} />
              {userErrors.name && <p className="field-hint" style={{ color: 'var(--color-danger)' }}>{userErrors.name}</p>}
            </Field>
            <Field label="Correo electrónico *">
              <input type="email" autoComplete="off" className="input-field" placeholder="usuario@ejemplo.com" value={newUser.email}
                onChange={e => setNewUser(prev => ({ ...prev, email: e.target.value }))} />
              {userErrors.email && <p className="field-hint" style={{ color: 'var(--color-danger)' }}>{userErrors.email}</p>}
            </Field>
            <Field label="Contraseña *">
              <input type="password" autoComplete="new-password" className="input-field" placeholder={`Mínimo ${MIN_PASSWORD} caracteres`} value={newUser.password}
                onChange={e => setNewUser(prev => ({ ...prev, password: e.target.value }))} />
              {userErrors.password && <p className="field-hint" style={{ color: 'var(--color-danger)' }}>{userErrors.password}</p>}
            </Field>
            <Field label="Rol / nivel de acceso">
              <select className="input-field" value={newUser.role} onChange={e => setNewUser(prev => ({ ...prev, role: e.target.value }))}>
                <option value="admin">Administrador — acceso total</option>
                <option value="employee">Colaborador — ventas e inventario</option>
                <option value="viewer">Solo lectura — solo reportes</option>
              </select>
            </Field>
            <div className="alert alert-info">{ROLE_META[newUser.role]?.desc}</div>
            <button type="submit" className="btn-primary" disabled={!!saving} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Plus size={16} /> {isSaving('user-add') ? 'Guardando…' : 'Crear usuario'}
            </button>
          </form>

          <div className="card" style={stack(16)}>
            <SectionTitle title="Usuarios registrados" desc={`${users.filter(u => u.active).length} activo(s) de ${users.length}`} />
            {usersLoading && users.length === 0 ? (
              <div className="empty-state"><div className="spinner" /></div>
            ) : users.length === 0 ? (
              <div className="empty-state">
                <Users size={32} style={{ opacity: 0.4 }} />
                <h3>Sin usuarios</h3>
                <p>Crea el primero desde el formulario.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr><th>Usuario</th><th>Rol</th><th>Estado</th><th style={{ textAlign: 'right' }}>Acceso</th></tr>
                  </thead>
                  <tbody>
                    {users.map(user => {
                      const isMe = user.id === currentUser.id;
                      const busy = saving === `user-${user.id}`;
                      return (
                        <tr key={user.id} style={{ opacity: user.active ? 1 : 0.65 }}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--color-primary-soft)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>
                                {(user.name || '?').charAt(0).toUpperCase()}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 600 }}>{user.name}{isMe && <span className="badge" style={{ marginLeft: 6 }}>Tú</span>}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{user.email}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <select className="input-field" style={{ minHeight: 34, padding: '4px 32px 4px 10px', fontSize: 13, width: 'auto' }}
                              value={user.role} disabled={!!saving || isMe} onChange={e => handleChangeRole(user, e.target.value)}
                              title={isMe ? 'No puedes cambiar tu propio rol' : 'Cambiar rol'}>
                              {Object.entries(ROLE_META).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
                            </select>
                          </td>
                          <td>
                            <span className={`badge ${user.active ? 'badge-success' : 'badge-warning'}`}>{user.active ? 'Activo' : 'Sin acceso'}</span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: 6 }}>
                              <button type="button" className="btn-ghost btn-sm" disabled={!!saving}
                                title="Restablecer contraseña" onClick={() => { setPwdUser(user); setPwdValue(''); }}>
                                Contraseña
                              </button>
                              <button type="button" className={`btn-sm ${user.active ? 'btn-secondary' : 'btn-success'}`}
                                disabled={!!saving || isMe} onClick={() => handleToggleActive(user)}>
                                {busy ? '…' : user.active ? 'Desactivar' : 'Activar'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="field-hint">
              Las contraseñas las guarda Supabase Auth cifradas; nadie (ni el administrador) puede verlas.
              Si alguien olvida la suya, usa el botón «Contraseña» para asignarle una nueva.
            </p>
            {pwdUser && (
              <div className="modal-overlay" onClick={() => !saving && setPwdUser(null)}>
                <form className="modal" style={{ maxWidth: 420, ...stack(14) }} onClick={e => e.stopPropagation()} onSubmit={handleResetPassword}>
                  <div>
                    <h3 style={{ fontSize: 17, fontWeight: 700 }}>Nueva contraseña</h3>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{pwdUser.name} · {pwdUser.email}</p>
                  </div>
                  <input type="password" autoFocus autoComplete="new-password" className="input-field"
                    placeholder={`Mínimo ${MIN_PASSWORD} caracteres`} value={pwdValue} onChange={e => setPwdValue(e.target.value)} />
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button type="button" className="btn-secondary" disabled={!!saving} onClick={() => setPwdUser(null)}>Cancelar</button>
                    <button type="submit" className="btn-primary" disabled={!!saving}>{saving ? 'Guardando…' : 'Guardar contraseña'}</button>
                  </div>
                </form>
              </div>
            )}

            <div>
              <p style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: 8 }}>Permisos por rol</p>
              <div className="table-wrap">
                <table className="data-table" style={{ fontSize: 13 }}>
                  <thead>
                    <tr><th>Sección</th><th style={{ textAlign: 'center' }}>Admin</th><th style={{ textAlign: 'center' }}>Colaborador</th><th style={{ textAlign: 'center' }}>Lectura</th></tr>
                  </thead>
                  <tbody>
                    {PERMISSIONS.map(([section, ...perms]) => (
                      <tr key={section}>
                        <td style={{ fontWeight: 500 }}>{section}</td>
                        {perms.map((p, i) => <td key={i} style={{ textAlign: 'center' }}>{PERM_BADGE[p]}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BASE DE DATOS */}
      {activeTab === 'database' && (
        <div className="card" style={stack(16)}>
          <SectionTitle icon={Database} title="Conexión con Supabase" />
          <div className={`alert ${supabaseOn ? 'alert-success' : 'alert-danger'}`} style={{ fontSize: 14, fontWeight: 500 }}>
            {supabaseOn
              ? <><CheckCircle size={18} /> Conectado: la base de datos Supabase está activa.</>
              : <><AlertCircle size={18} /> Sin conexión: revisa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el archivo .env.</>}
          </div>
          <div style={{ background: 'var(--bg-subtle)', borderRadius: 'var(--radius)', padding: 16, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 8 }}>Variables requeridas en <code>.env</code></strong>
            <pre style={{ background: '#111827', color: '#A7F3D0', padding: 12, borderRadius: 'var(--radius-sm)', fontSize: 12, overflowX: 'auto', margin: 0 }}>
{`VITE_SUPABASE_URL=https://xxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...`}
            </pre>
            <p style={{ marginTop: 10 }}>Las credenciales se configuran una sola vez en el <code>.env</code> del proyecto (y en las variables de entorno de Vercel). Para una base nueva ejecuta <code>supabase/schema.sql</code> en el SQL Editor de Supabase.</p>
          </div>
          <div>
            <span className="field-label">Tablas requeridas</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {['profiles', 'config', 'categories', 'products', 'customers', 'sales', 'sale_items', 'cash_sessions', 'cash_movements', 'action_logs'].map(t => (
                <span key={t} className="badge" style={{ fontFamily: 'monospace' }}>{t}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE RECORTE (zoom y arrastre) */}
      {showCropModal && cropImageSrc && (
        <div className="modal-overlay" onClick={() => !heroUploading && closeCropper()}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560, ...stack(16) }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <h3 style={{ fontSize: 17, fontWeight: 600 }}>{editingIdx !== null ? 'Reemplazar imagen del slider' : 'Ajustar imagen del slider'}</h3>
              <button type="button" className="btn-ghost btn-icon" onClick={closeCropper} disabled={heroUploading} aria-label="Cerrar"><X size={18} /></button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: -8 }}>
              Arrastra la imagen para encuadrarla y usa el control de zoom. El recuadro muestra cómo se verá en la portada.
            </p>

            <div
              ref={cropBoxRef}
              onMouseDown={handleDragStart}
              onMouseMove={handleDragMove}
              onMouseUp={handleDragEnd}
              onMouseLeave={handleDragEnd}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleDragEnd}
              style={{
                width: '100%', maxWidth: 480, aspectRatio: '16 / 9', margin: '0 auto',
                background: '#111', position: 'relative', overflow: 'hidden',
                cursor: isDragging ? 'grabbing' : 'grab', borderRadius: 'var(--radius)',
                outline: '2px solid var(--color-primary)', userSelect: 'none', touchAction: 'none'
              }}
            >
              <img
                ref={imageRef}
                src={cropImageSrc}
                alt="Vista previa para recorte"
                draggable={false}
                style={{
                  position: 'absolute', left: '50%', top: '50%',
                  transform: `translate(-50%, -50%) translate(${cropOffset.x}px, ${cropOffset.y}px) scale(${cropZoom})`,
                  maxWidth: '100%', maxHeight: '100%', pointerEvents: 'none', userSelect: 'none'
                }}
              />
            </div>

            <div style={stack(6)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span className="field-label" style={{ marginBottom: 0 }}>Zoom</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.round(cropZoom * 100)}%</span>
              </div>
              <input type="range" min="1" max="3" step="0.05" value={cropZoom}
                onChange={e => setCropZoom(parseFloat(e.target.value) || 1)} style={{ width: '100%', accentColor: 'var(--color-primary)' }} />
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button type="button" className="btn-secondary" onClick={closeCropper} disabled={heroUploading} style={{ flex: 1 }}>Cancelar</button>
              <button type="button" className="btn-primary" onClick={handleCropSave} disabled={heroUploading} style={{ flex: 1 }}>
                {heroUploading ? 'Guardando…' : 'Recortar y guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
