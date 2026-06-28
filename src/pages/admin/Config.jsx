import { useState, useEffect, useRef } from 'react';
import { 
  Settings, Save, Upload, Database, Code, 
  CheckCircle, MessageSquare, Star, Trash2, Plus, Users, Globe, Tag, Image, X, Video
} from 'lucide-react';
import { DataService } from '../../services/dataService';
import { VideoPlayer, SafeImage } from '../../components/MediaResolver';
import { autoCropToContent } from '../../utils/imageAutofit';
import { applyFavicon } from '../../utils/favicon';

export default function Config() {
  const loggedInUserRaw = localStorage.getItem('admin_user');
  const currentUser = loggedInUserRaw ? JSON.parse(loggedInUserRaw) : { name: 'Admin Principal', role: 'admin' };

  const [activeTab, setActiveTab] = useState('general'); // 'general', 'wholesale', 'reviews', 'footer', 'users', 'videos', 'database'
  const [config, setConfig] = useState(null);
  const [savedMsg, setSavedMsg] = useState(false);
  
  // Image uploading states
  const [logoUploading, setLogoUploading] = useState(false);
  const [favUploading, setFavUploading] = useState(false);

  // Video State
  const [newVideo, setNewVideo] = useState({ title: '', desc: '', url: '' });
  const [videoUploading, setVideoUploading] = useState(false);

  // Products list to filter offers
  const [products, setProducts] = useState([]);

  // General Hero List State
  const [heroUploading, setHeroUploading] = useState(false);
  const [heroEditMsg, setHeroEditMsg] = useState('');

  // Slider Cropper States
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [editingIdx, setEditingIdx] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageRef = useRef(null);

  // New review form
  const [newReview, setNewReview] = useState({ name: '', stars: 5, comment: '' });
  // New user form
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'employee', password: '' });

  // Employee Password Change states
  const [empPasswordForm, setEmpPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [empError, setEmpError] = useState('');
  const [empSuccess, setEmpSuccess] = useState('');

  const handleChangeEmployeePassword = async (e) => {
    e.preventDefault();
    setEmpError('');
    setEmpSuccess('');
    
    const updatedUsers = [...(config.users || [])];
    const userIdx = updatedUsers.findIndex(u => u.id === currentUser.id);
    
    if (userIdx === -1) {
      setEmpError('No se encontró el registro de tu usuario.');
      return;
    }
    
    const userObj = updatedUsers[userIdx];
    if ((userObj.password || 'password') !== empPasswordForm.oldPassword) {
      setEmpError('La contraseña actual es incorrecta.');
      return;
    }
    
    if (empPasswordForm.newPassword !== empPasswordForm.confirmPassword) {
      setEmpError('Las nuevas contraseñas no coinciden.');
      return;
    }

    updatedUsers[userIdx] = { ...userObj, password: empPasswordForm.newPassword };
    const updatedConfig = { ...config, users: updatedUsers };
    setConfig(updatedConfig);
    await DataService.saveConfig(updatedConfig);
    await DataService.addActionLog(`Cambió su contraseña de acceso`, currentUser.name);
    
    const updatedSessionUser = { ...currentUser, password: empPasswordForm.newPassword };
    localStorage.setItem('admin_user', JSON.stringify(updatedSessionUser));

    setEmpSuccess('¡Contraseña cambiada con éxito!');
    setEmpPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
  };

  // Supabase connection testing states
  const [dbCreds, setDbCreds] = useState({ url: '', key: '' });
  const [testStatus, setTestStatus] = useState('idle'); // 'idle', 'testing', 'success', 'error'
  const [testMsg, setTestMsg] = useState('');

  useEffect(() => {
    const loadConfigAndProducts = async () => {
      const cfg = await DataService.getConfig();
      setConfig(cfg);
      const prods = await DataService.getProducts();
      setProducts(prods);
      
      const creds = await DataService.getCredentials();
      setDbCreds(creds);
    };
    loadConfigAndProducts();
  }, []);

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestMsg('');
    const res = await DataService.testSupabaseConnection(dbCreds.url, dbCreds.key);
    if (res.success) {
      setTestStatus('success');
      setTestMsg(res.message);
    } else {
      setTestStatus('error');
      setTestMsg(res.message);
    }
  };

  const handleSaveCredentials = async () => {
    await DataService.saveCredentials(dbCreds.url, dbCreds.key);
    showSavedBanner();
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    await DataService.saveConfig(config);
    await DataService.addActionLog(`Actualizó la configuración de la tienda`, currentUser.name);
    showSavedBanner();
  };

  const handleUploadLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const optimized = await autoCropToContent(file); // recorta márgenes vacíos para que el logo ocupe el máximo espacio
      const url = await DataService.uploadImage(optimized);
      const updatedConfig = { ...config, storeLogoUrl: url };
      setConfig(updatedConfig);
      await DataService.saveConfig(updatedConfig); // guardar de inmediato, sin esperar al botón "Guardar"
      await DataService.addActionLog('Actualizó el logo de la tienda', currentUser.name);
      showSavedBanner();
    } catch (err) {
      console.error(err);
    } finally {
      setLogoUploading(false);
    }
  };

  const handleUploadFavicon = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFavUploading(true);
    try {
      const optimized = await autoCropToContent(file, { paddingRatio: 0.04 }); // favicon: margen mínimo para maximizar el ícono dentro del cuadro
      const url = await DataService.uploadImage(optimized);
      const updatedConfig = { ...config, storeFaviconUrl: url };
      setConfig(updatedConfig);
      await DataService.saveConfig(updatedConfig); // guardar de inmediato, sin esperar al botón "Guardar"
      applyFavicon(url); // refrescar el ícono de la pestaña ya mismo, en esta sesión
      await DataService.addActionLog('Actualizó el favicon de la tienda', currentUser.name);
      showSavedBanner();
    } catch (err) {
      console.error(err);
    } finally {
      setFavUploading(false);
    }
  };

  // --- ADMINISTRAR HERO IMAGES LIST ---
  const handleUploadHeroImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(reader.result);
      setEditingIdx(null);
      setCropZoom(1);
      setCropOffset({ x: 0, y: 0 });
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveHeroImage = (idx) => {
    const updatedImages = config.heroImages.filter((_, i) => i !== idx);
    const updatedConfig = { ...config, heroImages: updatedImages };
    setConfig(updatedConfig);
    DataService.saveConfig(updatedConfig);
    showSavedBanner();
  };

  const handleEditHeroImage = (e, idx) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(reader.result);
      setEditingIdx(idx);
      setCropZoom(1);
      setCropOffset({ x: 0, y: 0 });
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Manejadores de arrastre/paneo del cropper
  const handleDragStart = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - cropOffset.x, y: e.clientY - cropOffset.y });
  };

  const handleDragMove = (e) => {
    if (!isDragging) return;
    setCropOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX - cropOffset.x, y: e.touches[0].clientY - cropOffset.y });
    }
  };

  const handleTouchMove = (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    setCropOffset({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y
    });
  };

  const dataURLtoFile = (dataurl, filename) => {
    let arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, {type:mime});
  };

  const handleCropSave = async () => {
    try {
      const imgElement = imageRef.current;
      if (!imgElement) return;

       const canvas = document.createElement('canvas');
       canvas.width = 1600;
       canvas.height = 900;
       const ctx = canvas.getContext('2d');

       const cw = 480;
       const ch = 270;

      const imgWidth = imgElement.naturalWidth || imgElement.width || 1600;
      const imgHeight = imgElement.naturalHeight || imgElement.height || 900;

      const imgAspect = imgWidth / imgHeight;
      const containerAspect = cw / ch;

      let previewWidth, previewHeight;
      if (imgAspect > containerAspect) {
        previewWidth = cw;
        previewHeight = cw / imgAspect;
      } else {
        previewHeight = ch;
        previewWidth = ch * imgAspect;
      }

      const scaleToCanvas = 1600 / cw;

      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const drawWidth = previewWidth * cropZoom * scaleToCanvas;
      const drawHeight = previewHeight * cropZoom * scaleToCanvas;
      const translateX = cropOffset.x * scaleToCanvas;
      const translateY = cropOffset.y * scaleToCanvas;

      ctx.save();
      ctx.translate(canvas.width / 2 + translateX, canvas.height / 2 + translateY);
      ctx.drawImage(imgElement, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      ctx.restore();

      const croppedBase64 = canvas.toDataURL('image/jpeg', 0.9);
      
      setHeroUploading(true);
      setShowCropModal(false);
      
      const fileObj = dataURLtoFile(croppedBase64, 'cropped_slider.jpg');
      const url = await DataService.uploadImage(fileObj);
      
      let updatedImages = [...(config.heroImages || [])];
      if (editingIdx !== null) {
        updatedImages[editingIdx] = url;
        setHeroEditMsg('¡Imagen del Slider recortada, editada y actualizada con éxito!');
      } else {
        updatedImages.push(url);
        setHeroEditMsg('¡Imagen del Slider recortada y añadida con éxito!');
      }
      
      const updatedConfig = { ...config, heroImages: updatedImages };
      setConfig(updatedConfig);
      await DataService.saveConfig(updatedConfig);
      showSavedBanner();
    } catch (err) {
      console.error(err);
      setHeroEditMsg('Error al guardar la imagen recortada.');
    } finally {
      setHeroUploading(false);
      setCropImageSrc(null);
      setCropZoom(1);
      setCropOffset({ x: 0, y: 0 });
      setEditingIdx(null);
    }
  };

  // --- ADMINISTRAR SELECCIÓN DE OFERTAS ---
  const handleToggleOfferSelection = async (productId) => {
    const currentSelected = config.selectedOffers || [];
    let updatedSelected = [];
    if (currentSelected.includes(productId)) {
      updatedSelected = currentSelected.filter(id => id !== productId);
    } else {
      updatedSelected = [...currentSelected, productId];
    }
    const updatedConfig = { ...config, selectedOffers: updatedSelected };
    setConfig(updatedConfig);
    await DataService.saveConfig(updatedConfig);
    showSavedBanner();
  };

  // --- ADMINISTRAR VIDEOS ---
  const handleUploadVideoFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoUploading(true);
    try {
      const url = await DataService.uploadImage(file);
      setNewVideo(prev => ({ ...prev, url }));
      showSavedBanner();
    } catch (err) {
      console.error(err);
    } finally {
      setVideoUploading(false);
    }
  };

  const handleAddVideo = async (e) => {
    e.preventDefault();
    if (!newVideo.title || !newVideo.url) return;
    const videoItem = {
      id: 'v-' + Math.random().toString(36).substr(2, 9),
      title: newVideo.title,
      desc: newVideo.desc,
      url: newVideo.url
    };
    const updatedVideos = [...(config.videos || []), videoItem];
    const updatedConfig = { ...config, videos: updatedVideos };
    setConfig(updatedConfig);
    await DataService.saveConfig(updatedConfig);
    setNewVideo({ title: '', desc: '', url: '' });
    showSavedBanner();
  };

  const handleDeleteVideo = async (id) => {
    const filtered = config.videos.filter(v => v.id !== id);
    const updatedConfig = { ...config, videos: filtered };
    setConfig(updatedConfig);
    await DataService.saveConfig(updatedConfig);
    showSavedBanner();
  };

  // --- RESEÑAS ---
  const handleAddReview = async (e) => {
    e.preventDefault();
    if (!newReview.name || !newReview.comment) return;
    const review = {
      id: 't-' + Math.random().toString(36).substr(2, 9),
      name: newReview.name,
      stars: parseInt(newReview.stars) || 5,
      comment: newReview.comment,
      date: new Date().toISOString().slice(0, 10)
    };

    const updatedTestimonials = [...(config.testimonials || []), review];
    const updatedConfig = { ...config, testimonials: updatedTestimonials };
    setConfig(updatedConfig);
    await DataService.saveConfig(updatedConfig);
    setNewReview({ name: '', stars: 5, comment: '' });
    showSavedBanner();
  };

  const handleDeleteReview = async (id) => {
    const filtered = config.testimonials.filter(t => t.id !== id);
    const updatedConfig = { ...config, testimonials: filtered };
    setConfig(updatedConfig);
    await DataService.saveConfig(updatedConfig);
    showSavedBanner();
  };

  // --- USUARIOS ---
  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newUser.name || !newUser.email || !newUser.password) return;
    const user = {
      id: 'u-' + Math.random().toString(36).substr(2, 9),
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      password: newUser.password
    };

    const updatedUsers = [...(config.users || []), user];
    const updatedConfig = { ...config, users: updatedUsers };
    setConfig(updatedConfig);
    await DataService.saveConfig(updatedConfig);
    await DataService.addActionLog(`Agregó al usuario "${newUser.name}" (Rol: ${newUser.role})`, currentUser.name);
    setNewUser({ name: '', email: '', role: 'employee', password: '' });
    showSavedBanner();
  };

  const handleDeleteUser = async (id) => {
    const uName = config.users.find(u => u.id === id)?.name || id;
    const filtered = config.users.filter(u => u.id !== id);
    const updatedConfig = { ...config, users: filtered };
    setConfig(updatedConfig);
    await DataService.saveConfig(updatedConfig);
    await DataService.addActionLog(`Eliminó al usuario "${uName}"`, currentUser.name);
    showSavedBanner();
  };

  const showSavedBanner = () => {
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 3000);
  };

  const bootstrapSQL = `-- SQL BOOTSTRAP PARA SUPABASE
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL
);
`;

  if (!config) return null;

  if (currentUser.role === 'employee') {
    return (
      <div style={{ maxWidth: '500px', margin: '40px auto', width: '100%' }} className="card">
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '10px' }}>Configuración de Perfil</h3>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
          Cambia tu contraseña de acceso para la caja registradora y el terminal de ventas.
        </p>

        {empSuccess && (
          <div style={{ padding: '10px', backgroundColor: '#EBFBEE', color: '#2F855A', border: '1px solid #C6F6D5', marginBottom: '16px', fontSize: '13px' }}>
            {empSuccess}
          </div>
        )}
        {empError && (
          <div style={{ padding: '10px', backgroundColor: '#FFF5F5', color: '#C53030', border: '1px solid #FED7D7', marginBottom: '16px', fontSize: '13px' }}>
            {empError}
          </div>
        )}

        <form onSubmit={handleChangeEmployeePassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', fontWeight: 500 }}>Contraseña Actual</label>
            <input 
              type="password" 
              required 
              className="input-field" 
              value={empPasswordForm.oldPassword} 
              onChange={e => setEmpPasswordForm({ ...empPasswordForm, oldPassword: e.target.value })} 
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', fontWeight: 500 }}>Nueva Contraseña</label>
            <input 
              type="password" 
              required 
              className="input-field" 
              value={empPasswordForm.newPassword} 
              onChange={e => setEmpPasswordForm({ ...empPasswordForm, newPassword: e.target.value })} 
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', fontWeight: 500 }}>Confirmar Nueva Contraseña</label>
            <input 
              type="password" 
              required 
              className="input-field" 
              value={empPasswordForm.confirmPassword} 
              onChange={e => setEmpPasswordForm({ ...empPasswordForm, confirmPassword: e.target.value })} 
            />
          </div>
          <button type="submit" className="btn-primary" style={{ borderRadius: '0px', marginTop: '8px' }}>
            Actualizar Contraseña
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* MENÚ PESTAÑAS */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border-color)',
        gap: '20px',
        paddingBottom: '8px',
        flexWrap: 'wrap'
      }}>
        {[
          { id: 'general', label: 'Configuración General', icon: Globe },
          { id: 'wholesale', label: 'Carrusel de Promociones', icon: Tag },
          { id: 'reviews', label: 'Reseñas & Opiniones', icon: MessageSquare },
          { id: 'videos', label: 'Videos de Modelos', icon: Video },
          { id: 'footer', label: 'Pie de Página', icon: Settings },
          { id: 'users', label: 'Usuarios y Permisos', icon: Users },
          { id: 'database', label: 'Conexión Supabase', icon: Database }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: 'none',
                border: 'none',
                padding: '8px 4px',
                fontSize: '14px',
                fontWeight: 500,
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                borderBottom: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'var(--transition-fast)'
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {savedMsg && (
        <div style={{
          padding: '10px 12px',
          backgroundColor: '#EBFBEE',
          color: '#2F855A',
          border: '1px solid #C6F6D5',
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <CheckCircle size={14} /> Ajustes guardados y aplicados a la tienda en tiempo real.
        </div>
      )}

      {/* PESTAÑA: GENERAL */}
      {activeTab === 'general' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.7fr', gap: '24px', alignItems: 'start' }}>
          
          <form onSubmit={handleSave} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Identidad de Marca</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px' }}>Logo Corporativo</label>
                {config.storeLogoUrl ? (
                  <div style={{ border: '1px solid var(--border-color)', padding: '12px', backgroundColor: '#FAFAFA', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <img
                      src={config.storeLogoUrl}
                      alt="Logo actual"
                      style={{ maxHeight: '90px', maxWidth: '100%', objectFit: 'contain' }}
                    />
                    <div style={{ border: '1px dashed var(--border-color)', padding: '6px 12px', textAlign: 'center', backgroundColor: '#FFF', position: 'relative', cursor: 'pointer', fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input type="file" accept="image/*" onChange={handleUploadLogo} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, cursor: 'pointer' }} />
                      <Upload size={12} /> {logoUploading ? 'Subiendo...' : 'Cambiar Logo'}
                    </div>
                  </div>
                ) : (
                  <div style={{ border: '1px dashed var(--border-color)', padding: '16px', textAlign: 'center', backgroundColor: '#FAFAFA', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <input type="file" accept="image/*" onChange={handleUploadLogo} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, cursor: 'pointer' }} />
                    <Upload size={14} style={{ color: 'var(--text-secondary)' }} />
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{logoUploading ? 'Subiendo...' : 'Subir Logo (PNG/SVG recomendado)'}</span>
                  </div>
                )}
                <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px' }}>Se mostrará en navbar pública y panel admin. Fondo transparente recomendado.</p>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px' }}>Favicon del Sitio</label>
                {config.storeFaviconUrl ? (
                  <div style={{ border: '1px solid var(--border-color)', padding: '12px', backgroundColor: '#FAFAFA', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <img
                      src={config.storeFaviconUrl}
                      alt="Favicon actual"
                      style={{ width: '32px', height: '32px', objectFit: 'contain' }}
                    />
                    <div style={{ border: '1px dashed var(--border-color)', padding: '6px 12px', textAlign: 'center', backgroundColor: '#FFF', position: 'relative', cursor: 'pointer', fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input type="file" accept="image/*" onChange={handleUploadFavicon} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, cursor: 'pointer' }} />
                      <Upload size={12} /> {favUploading ? 'Subiendo...' : 'Cambiar Favicon'}
                    </div>
                  </div>
                ) : (
                  <div style={{ border: '1px dashed var(--border-color)', padding: '16px', textAlign: 'center', backgroundColor: '#FAFAFA', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <input type="file" accept="image/*" onChange={handleUploadFavicon} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, cursor: 'pointer' }} />
                    <Upload size={14} style={{ color: 'var(--text-secondary)' }} />
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{favUploading ? 'Subiendo...' : 'Subir Favicon (32x32 px)'}</span>
                  </div>
                )}
                <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px' }}>Ícono que aparece en la pestaña del navegador.</p>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px' }}>Nombre Comercial</label>
              <input type="text" className="input-field" value={config.storeName} onChange={e => handleTextChange('storeName', e.target.value)} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px' }}>Título Banner Hero</label>
              <input type="text" className="input-field" value={config.heroTitle} onChange={e => handleTextChange('heroTitle', e.target.value)} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px' }}>Subtítulo Hero</label>
              <textarea className="input-field" rows={2} value={config.heroSubtitle} onChange={e => handleTextChange('heroSubtitle', e.target.value)} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px' }}>Cinta Superior (Anuncio)</label>
              <input type="text" className="input-field" value={config.bannerText} onChange={e => handleTextChange('bannerText', e.target.value)} />
            </div>

            <button type="submit" className="btn-primary" style={{ alignSelf: 'flex-end', borderRadius: '0px' }}>
              Guardar Identidad
            </button>
          </form>

          {/* Gestión del Hero Image Slider */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Image size={18} />
              Imágenes del Hero Slider ({config.heroImages?.length || 0})
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '-6px' }}>Arrastra o selecciona archivos de imagen para añadirlos directamente al carrusel principal</p>

            {heroEditMsg && (
              <div style={{
                padding: '10px 12px',
                backgroundColor: '#EBFBEE',
                color: '#2F855A',
                border: '1px solid #C6F6D5',
                fontSize: '12px',
                fontWeight: 500,
                borderRadius: '0px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <CheckCircle size={14} /> {heroEditMsg}
              </div>
            )}

            <div style={{
              border: '2px dashed var(--border-color)',
              borderRadius: '0px',
              padding: '24px',
              textAlign: 'center',
              backgroundColor: '#FAFAFA',
              position: 'relative',
              cursor: 'pointer',
              transition: 'var(--transition-fast)'
            }}>
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleUploadHeroImage} 
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, cursor: 'pointer' }} 
              />
              <Upload size={24} style={{ color: 'var(--text-secondary)', marginBottom: '8px' }} />
              <span style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                {heroUploading ? 'Subiendo imagen...' : 'Cargar Nueva Imagen'}
              </span>
              <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                PNG, JPG, WEBP hasta 5MB (Se convertirá automáticamente)
              </span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '10px' }}>
              {config.heroImages?.map((url, idx) => (
                <div key={idx} style={{ position: 'relative', width: '90px', height: '60px', border: '1px solid var(--border-color)', backgroundColor: '#fff', padding: '2px' }}>
                  <SafeImage src={url} alt={`Hero ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  
                  {/* Botón Reemplazar/Editar */}
                  <label style={{
                    position: 'absolute',
                    bottom: '-6px',
                    left: '-6px',
                    backgroundColor: '#1a56db',
                    color: '#FFF',
                    borderRadius: '50%',
                    width: '18px',
                    height: '18px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    fontSize: '10px'
                  }} title="Editar/Reemplazar Imagen">
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => handleEditHeroImage(e, idx)} 
                      style={{ display: 'none' }} 
                    />
                    ✎
                  </label>

                  <button 
                    type="button" 
                    onClick={() => handleRemoveHeroImage(idx)}
                    style={{ position: 'absolute', top: '-6px', right: '-6px', backgroundColor: '#FF4D6D', color: '#FFF', border: 'none', borderRadius: '50%', width: '18px', height: '18px', cursor: 'pointer', fontSize: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
                    title="Eliminar Imagen"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* PESTAÑA: PROMOCIONES Y OFERTAS */}
      {activeTab === 'wholesale' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Selección de Ofertas para el Carrusel Público</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              El sistema detecta automáticamente los polos que tienen un precio de oferta (Precio Oferta) o precio mayorista (Precio por Mayor) configurados. Selecciona cuáles deseas mostrar en el carrusel de texto de la página de inicio.
            </p>
          </div>

          {products.filter(p => p.offer_price !== null || p.wholesale_price !== null).length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', backgroundColor: '#FAFAFA', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
              No se encontraron polos con precio de oferta o precio por mayor configurados. 
              <br />
              <span style={{ fontSize: '12px' }}>Modifica tus productos en el catálogo de administración para agregarles descuentos.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {products
                .filter(p => p.offer_price !== null || p.wholesale_price !== null)
                .map(p => {
                  const isSelected = config.selectedOffers?.includes(p.id);
                  return (
                    <div 
                      key={p.id} 
                      onClick={() => handleToggleOfferSelection(p.id)}
                      style={{
                        padding: '16px',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: isSelected ? '#F9F9F9' : '#FFF',
                        cursor: 'pointer',
                        transition: 'var(--transition-fast)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <input 
                          type="checkbox" 
                          checked={isSelected || false} 
                          onChange={() => {}} // handled by div click
                          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        <img src={p.image_url} alt={p.name} style={{ width: '50px', height: '50px', objectFit: 'cover', border: '1px solid var(--border-color)' }} />
                        <div>
                          <strong style={{ fontSize: '14px', display: 'block' }}>{p.name}</strong>
                          <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            <span>Precio Normal: S/. {p.price.toFixed(2)}</span>
                            {p.offer_price && (
                              <span style={{ color: '#E53E3E', fontWeight: 600 }}>Oferta: S/. {p.offer_price.toFixed(2)}</span>
                            )}
                            {p.wholesale_price && (
                              <span style={{ color: '#2B6CB0', fontWeight: 600 }}>Mayorista: S/. {p.wholesale_price.toFixed(2)} (Min {p.wholesale_min_qty} uds)</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div>
                        <span style={{
                          fontSize: '11px',
                          padding: '4px 8px',
                          backgroundColor: isSelected ? 'var(--color-primary)' : '#E2E8F0',
                          color: isSelected ? '#FFF' : 'var(--text-secondary)',
                          fontWeight: 600
                        }}>
                          {isSelected ? 'DESTACADO EN INICIO' : 'NO MOSTRAR'}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA: VIDEOS DE MODELOS */}
      {activeTab === 'videos' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '24px', alignItems: 'start' }}>
          
          <form onSubmit={handleAddVideo} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Cargar Video de Modelo</h3>
            
            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px' }}>Título del Video</label>
              <input type="text" required placeholder="Ej. Polo Oversize Charcoal en Exterior" className="input-field" value={newVideo.title} onChange={e => setNewVideo({ ...newVideo, title: e.target.value })} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px' }}>Descripción corta / Corte</label>
              <input type="text" placeholder="Ej. Algodón pesado de 240g con caída natural" className="input-field" value={newVideo.desc} onChange={e => setNewVideo({ ...newVideo, desc: e.target.value })} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px' }}>Subir Archivo de Video</label>
              <div style={{ border: '1px dashed var(--border-color)', padding: '16px', textAlign: 'center', backgroundColor: '#FAFAFA', position: 'relative' }}>
                <input type="file" accept="video/*" onChange={handleUploadVideoFile} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, cursor: 'pointer' }} />
                <Upload size={18} style={{ color: 'var(--text-secondary)', marginBottom: '6px' }} />
                <span style={{ display: 'block', fontSize: '11px', fontWeight: 500 }}>
                  {videoUploading ? 'Procesando Video...' : 'Selecciona archivo .mp4 / .webm'}
                </span>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px' }}>O Copiar URL Directa</label>
              <input type="text" placeholder="https://player.vimeo.com/external/..." className="input-field" value={newVideo.url} onChange={e => setNewVideo({ ...newVideo, url: e.target.value })} />
            </div>

            <button type="submit" className="btn-primary" style={{ display: 'flex', gap: '8px', justifyContent: 'center', borderRadius: '0px' }}>
              <Plus size={16} /> Añadir Video a Pasarela
            </button>
          </form>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Videos en Pasarela ({config.videos?.length || 0})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '450px', overflowY: 'auto' }}>
              {(config.videos || []).map(v => (
                <div key={v.id} style={{ padding: '16px', border: '1px solid var(--border-color)', display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <div style={{ width: '80px', height: '110px', backgroundColor: '#000', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                    <VideoPlayer url={v.url} title={v.title} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: '13px', display: 'block' }}>{v.title}</strong>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>{v.desc || 'Sin descripción'}</span>
                  </div>
                  <button type="button" onClick={() => handleDeleteVideo(v.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-secondary)' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* PESTAÑA: RESEÑAS */}
      {activeTab === 'reviews' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '24px', alignItems: 'start' }}>
          
          <form onSubmit={handleAddReview} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Agregar Reseña de Cliente</h3>
            
            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px' }}>Nombre del Cliente</label>
              <input type="text" required placeholder="Ej. Valeria M." className="input-field" value={newReview.name} onChange={e => setNewReview({ ...newReview, name: e.target.value })} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px' }}>Calificación (Estrellas)</label>
              <select className="input-field" value={newReview.stars} onChange={e => setNewReview({ ...newReview, stars: e.target.value })}>
                {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} Estrellas</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px' }}>Comentario de la Opinión</label>
              <textarea required placeholder="Escribe aquí el testimonio..." className="input-field" rows={4} value={newReview.comment} onChange={e => setNewReview({ ...newReview, comment: e.target.value })} />
            </div>

            <button type="submit" className="btn-primary" style={{ display: 'flex', gap: '8px', justifyContent: 'center', borderRadius: '0px' }}>
              <Plus size={16} /> Añadir Opinión
            </button>
          </form>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Testimonios Activos ({config.testimonials?.length || 0})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '420px', overflowY: 'auto' }}>
              {config.testimonials?.map(t => (
                <div key={t.id} style={{ padding: '16px', border: '1px solid var(--border-color)', display: 'flex', justifycontent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                      {[...Array(t.stars)].map((_, i) => <Star key={i} size={12} fill="var(--text-primary)" stroke="none" />)}
                    </div>
                    <strong style={{ fontSize: '13px', display: 'block' }}>{t.name}</strong>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', fontStyle: 'italic' }}>"{t.comment}"</p>
                  </div>
                  <button type="button" onClick={() => handleDeleteReview(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-secondary)' }}><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* PESTAÑA: PIE DE PÁGINA */}
      {activeTab === 'footer' && (
        <form onSubmit={handleSave} className="card" style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Datos del Pie de Página</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px' }}>WhatsApp de Soporte</label>
              <input type="text" className="input-field" value={config.footer?.whatsapp || ''} onChange={e => setConfig({ ...config, footer: { ...config.footer, whatsapp: e.target.value } })} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px' }}>Email Corporativo</label>
              <input type="email" className="input-field" value={config.footer?.email || ''} onChange={e => setConfig({ ...config, footer: { ...config.footer, email: e.target.value } })} />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px' }}>Dirección de Tienda Física</label>
            <input type="text" className="input-field" value={config.footer?.address || ''} onChange={e => setConfig({ ...config, footer: { ...config.footer, address: e.target.value } })} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px' }}>Facebook URL</label>
              <input type="text" className="input-field" value={config.footer?.facebookUrl || ''} onChange={e => setConfig({ ...config, footer: { ...config.footer, facebookUrl: e.target.value } })} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px' }}>Instagram URL</label>
              <input type="text" className="input-field" value={config.footer?.instagramUrl || ''} onChange={e => setConfig({ ...config, footer: { ...config.footer, instagramUrl: e.target.value } })} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px' }}>TikTok URL</label>
              <input type="text" className="input-field" value={config.footer?.tiktokUrl || ''} onChange={e => setConfig({ ...config, footer: { ...config.footer, tiktokUrl: e.target.value } })} />
            </div>
          </div>

          <button type="submit" className="btn-primary" style={{ alignSelf: 'flex-end', borderRadius: '0px' }}>
            Guardar Redes y Contacto
          </button>
        </form>
      )}

      {/* PESTAÑA: USUARIOS Y PERMISOS */}
      {activeTab === 'users' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '24px', alignItems: 'start' }}>
          
          {/* Formulario agregar usuario */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Agregar Usuario</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Registra colaboradores con acceso al panel de administración y asígnales un rol.
            </p>

            <form onSubmit={handleAddUser} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', fontWeight: 500 }}>Nombre completo *</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ej: María López"
                  value={newUser.name}
                  onChange={e => setNewUser(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', fontWeight: 500 }}>Correo electrónico *</label>
                <input
                  type="email"
                  className="input-field"
                  placeholder="usuario@ejemplo.com"
                  value={newUser.email}
                  onChange={e => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', fontWeight: 500 }}>Contraseña *</label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="Definir contraseña"
                  value={newUser.password}
                  onChange={e => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', fontWeight: 500 }}>Rol / Nivel de acceso</label>
                <select
                  className="input-field"
                  value={newUser.role}
                  onChange={e => setNewUser(prev => ({ ...prev, role: e.target.value }))}
                  style={{ width: '100%' }}
                >
                  <option value="admin">Administrador — Acceso total</option>
                  <option value="employee">Colaborador — Ventas e inventario</option>
                  <option value="viewer">Solo lectura — Solo ver reportes</option>
                </select>
              </div>

              {/* Descripción del rol seleccionado */}
              <div style={{
                padding: '10px 12px',
                backgroundColor: '#F8F9FA',
                border: '1px solid var(--border-color)',
                fontSize: '12px',
                color: 'var(--text-secondary)',
                lineHeight: 1.5
              }}>
                {newUser.role === 'admin' && '🔐 Administrador: puede modificar configuración, productos, usuarios y ver todos los reportes.'}
                {newUser.role === 'employee' && '🛒 Colaborador: puede registrar ventas en caja, gestionar inventario de polos y arqueo propio.'}
                {newUser.role === 'viewer' && '👁 Solo lectura: puede consultar reportes y estadísticas sin modificar nada.'}
              </div>

              <button
                type="submit"
                className="btn-primary"
                style={{ padding: '10px', fontSize: '13px', fontWeight: 600, borderRadius: '0px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <Plus size={16} /> Agregar Usuario
              </button>
            </form>
          </div>

          {/* Lista de usuarios */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Usuarios Registrados</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {(config.users || []).length} usuario(s) en el sistema
              </p>
            </div>

            {(config.users || []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
                <Users size={32} strokeWidth={1} style={{ marginBottom: '12px', opacity: 0.4 }} />
                <p style={{ fontSize: '13px' }}>No hay usuarios registrados aún.</p>
                <p style={{ fontSize: '12px', marginTop: '4px' }}>Agrega el primero desde el formulario.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(config.users || []).map(user => {
                  const roleColors = {
                    admin: { bg: '#EEF2FF', text: '#4338CA', label: 'Admin' },
                    employee: { bg: '#F0FDF4', text: '#16A34A', label: 'Colaborador' },
                    viewer: { bg: '#FFF7ED', text: '#C2410C', label: 'Lectura' }
                  };
                  const roleStyle = roleColors[user.role] || roleColors.viewer;
                  return (
                    <div key={user.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: '#FAFAFA'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {/* Avatar inicial */}
                        <div style={{
                          width: '36px', height: '36px',
                          borderRadius: '50%',
                          backgroundColor: roleStyle.bg,
                          color: roleStyle.text,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '14px', fontWeight: 700
                        }}>
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600 }}>{user.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{user.email}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{
                          fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em',
                          padding: '3px 8px',
                          backgroundColor: roleStyle.bg,
                          color: roleStyle.text,
                          textTransform: 'uppercase'
                        }}>
                          {roleStyle.label}
                        </span>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E53E3E', padding: '4px' }}
                          title="Eliminar usuario"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Info de permisos por rol */}
            <div style={{ marginTop: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '10px' }}>Tabla de Permisos</p>
              <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F4F4F5' }}>
                    <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600 }}>Sección</th>
                    <th style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 600 }}>Admin</th>
                    <th style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 600 }}>Colaborador</th>
                    <th style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 600 }}>Lectura</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Dashboard', '✅', '✅', '✅'],
                    ['Productos', '✅', '✅', '👁'],
                    ['Inventario', '✅', '✅', '👁'],
                    ['Caja / POS', '✅', '✅', '❌'],
                    ['Clientes', '✅', '✅', '👁'],
                    ['Reportes', '✅', '✅', '✅'],
                    ['Configuración', '✅', '❌', '❌'],
                    ['Usuarios', '✅', '❌', '❌'],
                  ].map(([section, ...perms]) => (
                    <tr key={section} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '6px 10px', fontWeight: 500 }}>{section}</td>
                      {perms.map((p, i) => (
                        <td key={i} style={{ padding: '6px 10px', textAlign: 'center' }}>{p}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA: CONEXIÓN SUPABASE */}
      {activeTab === 'database' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={18} />
              Estado de Conexión Supabase
            </h3>
            <div style={{
              padding: '20px',
              border: `1px solid ${DataService.isSupabaseEnabled() ? '#C6F6D5' : '#FED7D7'}`,
              backgroundColor: DataService.isSupabaseEnabled() ? '#EBFBEE' : '#FFF5F5',
              color: DataService.isSupabaseEnabled() ? '#2F855A' : '#C53030',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '14px',
              fontWeight: 600
            }}>
              {DataService.isSupabaseEnabled() ? (
                <><CheckCircle size={18} /> Conectado — Base de datos Supabase activa y funcionando.</>
              ) : (
                <><span>❌</span> Sin conexión — Revisa las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en tu archivo .env</>
              )}
            </div>
            <div style={{ backgroundColor: '#FAFAFA', border: '1px solid var(--border-color)', padding: '16px', fontSize: '12px', lineHeight: 1.8, color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>Configuración requerida en <code>.env</code>:</strong>
              <code style={{ display: 'block', backgroundColor: '#111', color: '#7CFC00', padding: '12px', fontSize: '11px', lineHeight: 2 }}>
                VITE_SUPABASE_URL=https://xxxxxx.supabase.co<br />
                VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
              </code>
              <p style={{ marginTop: '10px' }}>Las credenciales se configuran una sola vez en el archivo <code>.env</code> del proyecto. Corre el script SQL incluido en el proyecto para crear todas las tablas.</p>
            </div>
            <div>
              <h4 style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>Tablas requeridas en Supabase:</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
                {['config', 'categories', 'products', 'customers', 'sales', 'sale_items', 'cash_sessions', 'cash_movements', 'action_logs'].map(t => (
                  <div key={t} style={{ padding: '6px 10px', border: '1px solid var(--border-color)', fontSize: '11px', fontFamily: 'monospace', backgroundColor: '#FFF', color: 'var(--text-primary)' }}>
                    {t}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE RECORTE DE IMAGEN INTERACTIVO (Zoom & Drag) */}
      {showCropModal && cropImageSrc && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div className="card" style={{
            backgroundColor: '#FFF',
            padding: '24px',
            maxWidth: '550px',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            borderRadius: '0px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
            alignItems: 'center'
          }}>
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Ajustar y Recortar Imagen para el Slider</h3>
              <button 
                type="button" 
                onClick={() => { setShowCropModal(false); setCropImageSrc(null); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '-8px' }}>
              Arrastra la imagen para moverla y usa el control inferior para hacer zoom. El recuadro de borde dorado representa cómo se verá en el slider.
            </p>

            {/* Contenedor del crop frame (Aspecto 16:9) */}
            <div 
              onMouseDown={handleDragStart}
              onMouseMove={handleDragMove}
              onMouseUp={handleDragEnd}
              onMouseLeave={handleDragEnd}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleDragEnd}
              style={{
                width: '480px',
                height: '270px',
                backgroundColor: '#111',
                position: 'relative',
                overflow: 'hidden',
                cursor: 'move',
                border: '2px solid #DFB15B',
                boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)',
                userSelect: 'none'
              }}
            >
              <img 
                ref={imageRef}
                src={cropImageSrc} 
                alt="Vista previa para recorte" 
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: `translate(-50%, -50%) translate(${cropOffset.x}px, ${cropOffset.y}px) scale(${cropZoom})`,
                  maxWidth: '100%',
                  maxHeight: '100%',
                  pointerEvents: 'none',
                  userSelect: 'none'
                }}
              />
              {/* Overlay semitransparente */}
              <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.2)',
                pointerEvents: 'none'
              }} />
            </div>

            {/* Zoom Slider */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span>Zoom</span>
                <span>{Math.round(cropZoom * 100)}%</span>
              </div>
              <input 
                type="range" 
                min="1" 
                max="3" 
                step="0.05"
                value={cropZoom}
                onChange={(e) => setCropZoom(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#DFB15B' }}
              />
            </div>

            {/* Botones */}
            <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '8px' }}>
              <button 
                type="button" 
                onClick={handleCropSave}
                className="btn-primary" 
                style={{ flex: 1, backgroundColor: '#DFB15B', color: '#111', border: 'none', fontWeight: 600, padding: '10px', fontSize: '13px', borderRadius: '0px' }}
              >
                Recortar y Guardar
              </button>
              <button 
                type="button" 
                onClick={() => { setShowCropModal(false); setCropImageSrc(null); }}
                className="btn-secondary" 
                style={{ flex: 1, padding: '10px', fontSize: '13px', borderRadius: '0px' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );

  function handleTextChange(field, val) {
    setConfig(prev => ({ ...prev, [field]: val }));
  }
}
