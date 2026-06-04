import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, Edit3, ImageOff, Loader2, PackagePlus, Search, Trash2, X } from 'lucide-react'
import Navbar from '../components/Navbar.jsx'
import { supabase } from '../supabase.js'
import { money } from '../utils/business.js'

const CATEGORIAS = ['Granos', 'Lacteos', 'Bebidas', 'Snacks', 'Limpieza', 'Personal', 'Verduras', 'Carnes', 'Otros']

const emptyForm = {
  nombre: '',
  descripcion: '',
  precio: '',
  imagen_url: '',
  categoria: 'Otros',
  stock: 0,
  participa_promocion: false,
  activo: true,
}

function Modal({ title, onClose, children }) {
  return (
    <div className="modal-overlay">
      <div className="modal-panel">
        <div className="modal-header">
          <h2 className="font-display">{title}</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function Productos() {
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [imagenFile, setImagenFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [query, setQuery] = useState('')
  const [categoria, setCategoria] = useState('Todos')
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  async function loadProductos() {
    setLoading(true)
    const { data, error: fetchError } = await supabase
      .from('productos')
      .select('*')
      .order('nombre')

    if (fetchError) setError(fetchError.message)
    else setProductos(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadProductos()
  }, [])

  const filteredProducts = useMemo(() => {
    return productos.filter((producto) => {
      const matchesSearch = producto.nombre?.toLowerCase().includes(query.toLowerCase())
      const matchesCategory = categoria === 'Todos' || producto.categoria === categoria
      return matchesSearch && matchesCategory
    })
  }, [productos, query, categoria])

  function openCreateModal() {
    setEditingProduct(null)
    setForm(emptyForm)
    setImagenFile(null)
    setPreviewUrl('')
    setError('')
    setModalOpen(true)
  }

  function openEditModal(producto) {
    setEditingProduct(producto)
    setForm({
      nombre: producto.nombre || '',
      descripcion: producto.descripcion || '',
      precio: producto.precio ?? '',
      imagen_url: producto.imagen_url || '',
      categoria: producto.categoria || 'Otros',
      stock: producto.stock ?? 0,
      participa_promocion: Boolean(producto.participa_promocion),
      activo: producto.activo !== false,
    })
    setImagenFile(null)
    setPreviewUrl(producto.imagen_url || '')
    setError('')
    setModalOpen(true)
  }

  function closeModal() {
    if (saving) return
    setModalOpen(false)
    setEditingProduct(null)
    setForm(emptyForm)
    setImagenFile(null)
    setPreviewUrl('')
    setError('')
  }

  function handleImageChange(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setImagenFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  function removeImage() {
    setImagenFile(null)
    setPreviewUrl('')
    setForm((current) => ({ ...current, imagen_url: '' }))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function uploadImageIfNeeded() {
    if (!imagenFile) return form.imagen_url

    const ext = imagenFile.name.split('.').pop()
    const fileName = `${Date.now()}.${ext}`
    const { data: upData, error: upError } = await supabase.storage
      .from('productos')
      .upload(fileName, imagenFile, { upsert: true })

    if (upError) {
      const bucketMessage = upError.message?.toLowerCase().includes('bucket')
        ? "Configura el bucket 'productos' en Supabase Storage"
        : `Error al subir imagen: ${upError.message}`
      throw new Error(bucketMessage)
    }

    const { data: urlData } = supabase.storage.from('productos').getPublicUrl(upData.path)
    return urlData.publicUrl
  }

  function validateForm() {
    if (!form.nombre.trim()) return 'El nombre es requerido'
    if (!form.precio || Number(form.precio) <= 0) return 'Ingresa un precio valido'
    return ''
  }

  async function saveProduct(event) {
    event.preventDefault()
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    setError('')
    try {
      const imagenUrl = await uploadImageIfNeeded()
      const payload = {
        ...form,
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim(),
        imagen_url: imagenUrl,
        precio: Number(form.precio),
        stock: Number(form.stock || 0),
      }

      const request = editingProduct
        ? supabase.from('productos').update(payload).eq('id', editingProduct.id)
        : supabase.from('productos').insert(payload)

      const { error: saveError } = await request
      if (saveError) throw saveError

      await loadProductos()
      closeModal()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleActivo(producto) {
    const { error: updateError } = await supabase
      .from('productos')
      .update({ activo: !producto.activo })
      .eq('id', producto.id)

    if (updateError) setError(updateError.message)
    else loadProductos()
  }

  async function deleteProduct(producto) {
    const confirmed = confirm(`Deseas desactivar "${producto.nombre}"?`)
    if (!confirmed) return

    const { error: updateError } = await supabase
      .from('productos')
      .update({ activo: false })
      .eq('id', producto.id)

    if (updateError) setError(updateError.message)
    else loadProductos()
  }

  return (
    <Navbar>
      <div className="products-page">
        <div className="products-header">
          <div>
            <h1 className="page-title">Productos</h1>
            <p className="page-subtitle">Crea, edita y controla el catalogo de productos de MALL.</p>
          </div>
          <button className="btn-primary" type="button" onClick={openCreateModal}>
            <PackagePlus size={18} /> Agregar producto
          </button>
        </div>

        <section className="card products-controls">
          <div className="search-field">
            <Search size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar producto..."
            />
          </div>
          <div className="category-scroll">
            {['Todos', ...CATEGORIAS].map((item) => (
              <button
                key={item}
                className={categoria === item ? 'chip active' : 'chip'}
                type="button"
                onClick={() => setCategoria(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        {error && !modalOpen ? <div className="error">{error}</div> : null}

        {loading ? (
          <div className="card empty">Cargando productos...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="card empty">No hay productos para mostrar.</div>
        ) : (
          <div className="product-list">
            {filteredProducts.map((producto) => (
              <article key={producto.id} className={`product-card ${producto.activo === false ? 'inactive' : ''}`}>
                <div className="product-thumb">
                  {producto.imagen_url ? <img src={producto.imagen_url} alt={producto.nombre} /> : <ImageOff size={26} />}
                </div>
                <div className="product-info">
                  <div className="product-title-row">
                    <h2>{producto.nombre}</h2>
                    {producto.activo === false ? <span className="badge-red">Inactivo</span> : null}
                  </div>
                  {producto.descripcion ? <p>{producto.descripcion}</p> : null}
                  <div className="product-meta">
                    <strong>{money(producto.precio)}</strong>
                    <span className="badge-gray">{producto.categoria || 'Otros'}</span>
                    {producto.participa_promocion ? <span className="badge-yellow">Promo</span> : null}
                    <span className="badge-green">Stock {producto.stock ?? 0}</span>
                  </div>
                </div>
                <div className="product-actions">
                  <button className="btn-outline" type="button" onClick={() => openEditModal(producto)}>
                    <Edit3 size={16} /> Editar
                  </button>
                  <button className="btn-outline" type="button" onClick={() => toggleActivo(producto)}>
                    {producto.activo === false ? 'Activar' : 'Desactivar'}
                  </button>
                  <button className="btn-danger" type="button" onClick={() => deleteProduct(producto)}>
                    <Trash2 size={16} /> Borrar
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {modalOpen ? (
        <Modal title={editingProduct ? 'Editar producto' : 'Agregar producto'} onClose={closeModal}>
          <form className="product-form" onSubmit={saveProduct}>
            <button className="image-dropzone" type="button" onClick={() => fileInputRef.current?.click()}>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} />
              {previewUrl ? (
                <img src={previewUrl} alt="Vista previa del producto" />
              ) : (
                <span className="image-empty">
                  <Camera size={34} />
                  <strong>Click para subir imagen</strong>
                  <small>JPG, PNG, WEBP</small>
                </span>
              )}
            </button>
            {previewUrl ? <button className="btn-outline" type="button" onClick={removeImage}>Quitar imagen</button> : null}

            <label className="form-row">
              Nombre *
              <input className="input-field" value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} />
            </label>
            <label className="form-row">
              Descripcion
              <textarea className="input-field" rows={2} value={form.descripcion} onChange={(event) => setForm({ ...form, descripcion: event.target.value })} />
            </label>
            <div className="form-split">
              <label className="form-row">
                Precio Q *
                <div className="money-input">
                  <span>Q</span>
                  <input type="number" step="0.01" min="0" value={form.precio} onChange={(event) => setForm({ ...form, precio: event.target.value })} />
                </div>
              </label>
              <label className="form-row">
                Stock
                <input className="input-field" type="number" min="0" value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} />
              </label>
            </div>
            <label className="form-row">
              Categoria
              <select className="input-field" value={form.categoria} onChange={(event) => setForm({ ...form, categoria: event.target.value })}>
                {CATEGORIAS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <div className="checkbox-row">
              <label><input type="checkbox" checked={form.activo} onChange={(event) => setForm({ ...form, activo: event.target.checked })} /> Activo</label>
              <label title="Los clientes veran este producto destacado"><input type="checkbox" checked={form.participa_promocion} onChange={(event) => setForm({ ...form, participa_promocion: event.target.checked })} /> En promocion</label>
            </div>
            {error ? <div className="error">{error}</div> : null}
            <button className="btn-primary" type="submit" disabled={saving}>
              {saving ? <Loader2 size={18} /> : <PackagePlus size={18} />}
              {saving ? 'Guardando...' : editingProduct ? 'Guardar cambios' : 'Agregar producto'}
            </button>
          </form>
        </Modal>
      ) : null}
    </Navbar>
  )
}
