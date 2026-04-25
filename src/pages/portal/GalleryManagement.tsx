import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Camera, Upload, Trash2, Star } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { callFunction } from '@/lib/api';
import { supabase } from '@/integrations/supabase/client';

interface GalleryImage {
  id: string;
  title: string;
  description: string;
  image_url: string;
  is_featured: boolean;
  created_at: string;
}

const GalleryManagement = () => {
  const { token } = useAuth();
  const { toast } = useToast();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    isFeatured: false,
    imageFile: null as File | null
  });

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    fetchImages();
  }, [token]);

  const fetchImages = async () => {
    if (!token) return;

    try {
      const response = await callFunction<{ images: GalleryImage[] }>('marketing-manage', {
        action: 'list-gallery-images',
      }, { token });

      const mapped = (response.images ?? []).map((item) => {
        const raw = item.image_url;
        if (raw && !raw.includes('://')) {
          const { data } = supabase.storage.from('news-media').getPublicUrl(raw);
          return { ...item, image_url: data?.publicUrl ?? raw };
        }
        return item;
      });

      setImages(mapped);
    } catch (error: any) {
      console.error('Error fetching gallery images:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load gallery images.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const isVideoUrl = (value: string | null | undefined) => {
    if (!value) return false;
    if (value.startsWith('data:video/')) return true;
    return /\.(mp4|webm|ogg)(\?|#|$)/i.test(value);
  };

  const handleImageUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.imageFile || !token) return;

    setUploading(true);
    try {
      const dataUrl = await fileToDataUrl(formData.imageFile);

      await callFunction('marketing-manage', {
        action: 'create-gallery-image',
        title: formData.title,
        description: formData.description,
        imageDataUrl: dataUrl,
        isFeatured: formData.isFeatured,
      }, { token });

      toast({
        title: "Image Uploaded",
        description: "Gallery image has been added successfully.",
      });

      setFormData({
        title: '',
        description: '',
        isFeatured: false,
        imageFile: null
      });

      fetchImages();
    } catch (error: any) {
      toast({
        title: "Upload Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const toggleFeatured = async (imageId: string, currentStatus: boolean) => {
    if (!token) return;

    try {
      await callFunction('marketing-manage', {
        action: 'update-gallery-image',
        imageId,
        patch: { is_featured: !currentStatus },
      }, { token });

      setImages(prev => prev.map(img => 
        img.id === imageId ? { ...img, is_featured: !currentStatus } : img
      ));

      toast({
        title: "Image Updated",
        description: `Image ${!currentStatus ? 'marked as featured' : 'removed from featured'}.`,
      });
    } catch (error: any) {
      console.error('Error updating image:', error);
      toast({
        title: 'Update Error',
        description: error.message || 'Failed to update image.',
        variant: 'destructive',
      });
    }
  };

  const deleteImage = async (imageId: string) => {
    if (!confirm('Are you sure you want to delete this image?')) return;
    if (!token) return;

    try {
      await callFunction('marketing-manage', {
        action: 'delete-gallery-image',
        imageId,
      }, { token });

      setImages(prev => prev.filter(img => img.id !== imageId));

      toast({
        title: "Image Deleted",
        description: "Gallery image has been removed.",
      });
    } catch (error: any) {
      console.error('Error deleting image:', error);
      toast({
        title: 'Delete Error',
        description: error.message || 'Failed to delete image.',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Gallery Management</h1>
          <p className="text-muted-foreground">
            Upload and manage images for the company gallery.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upload Form */}
          <div>
            <Card className="shadow-corporate border-card-border">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Upload size={20} />
                  <span>Add New Image</span>
                </CardTitle>
                <CardDescription>
                  Upload a new image to the gallery
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleImageUpload} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="featured"
                      checked={formData.isFeatured}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isFeatured: checked }))}
                    />
                    <Label htmlFor="featured">Featured Image</Label>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="image">Media File *</Label>
                    <Input
                      id="image"
                      type="file"
                      accept="image/*,video/*"
                      onChange={(e) => setFormData(prev => ({ ...prev, imageFile: e.target.files?.[0] || null }))}
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-gradient-primary hover:opacity-90"
                    disabled={uploading || !formData.title || !formData.imageFile}
                  >
                    {uploading ? 'Uploading...' : 'Upload Image'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Images Grid */}
          <div className="lg:col-span-2">
            <Card className="shadow-corporate border-card-border">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Camera size={20} />
                  <span>Gallery Images ({images.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {images.length === 0 ? (
                  <div className="text-center py-8">
                    <Camera size={48} className="mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No images uploaded yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {images.map((image) => (
                      <div key={image.id} className="group relative bg-card rounded-lg overflow-hidden border border-border">
                        <div className="aspect-square overflow-hidden">
                          {isVideoUrl(image.image_url) ? (
                            <video
                              src={image.image_url}
                              controls
                              playsInline
                              preload="metadata"
                              className="w-full h-full object-cover bg-black"
                            />
                          ) : (
                            <img
                              src={image.image_url}
                              alt={image.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          )}
                        </div>
                        <div className="p-3">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-semibold text-foreground line-clamp-1">{image.title}</h4>
                            {image.is_featured && (
                              <Badge variant="secondary" className="text-xs">
                                <Star size={12} className="mr-1" />
                                Featured
                              </Badge>
                            )}
                          </div>
                          {image.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                              {image.description}
                            </p>
                          )}
                          <div className="flex items-center space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toggleFeatured(image.id, image.is_featured)}
                            >
                              <Star size={14} className={image.is_featured ? 'fill-yellow-400 text-yellow-400' : ''} />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteImage(image.id)}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GalleryManagement;