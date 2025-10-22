import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Camera, Filter, ZoomIn } from 'lucide-react';

interface GalleryImage {
  id: string;
  title: string;
  description: string;
  image_url: string;
  is_featured: boolean;
  created_at: string;
}

const Gallery = () => {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [filteredImages, setFilteredImages] = useState<GalleryImage[]>([]);
  const [filter, setFilter] = useState('all');
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchImages = async () => {
    try {
      const { data, error } = await supabase
        .from('gallery_images')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setImages(data || []);
      setFilteredImages(data || []);
    } catch (error) {
      console.error('Error fetching gallery images:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, []);

  useEffect(() => {
    if (filter === 'all') {
      setFilteredImages(images);
    } else if (filter === 'featured') {
      setFilteredImages(images.filter(img => img.is_featured));
    }
  }, [filter, images]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary via-primary-dark to-primary py-20 relative">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center">
                <Camera size={40} className="text-white" />
              </div>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 animate-fade-in">
              Project Gallery
            </h1>
            <p className="text-xl text-white/90 mb-8 leading-relaxed animate-fade-in" style={{ animationDelay: '0.2s' }}>
              Explore our portfolio of completed projects across all engineering disciplines
            </p>
          </div>
        </div>
      </section>

      {/* Filter Section */}
      <section className="py-8 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-4">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              onClick={() => setFilter('all')}
              className="flex items-center space-x-2"
            >
              <Filter size={16} />
              <span>All Projects</span>
            </Button>
            <Button
              variant={filter === 'featured' ? 'default' : 'outline'}
              onClick={() => setFilter('featured')}
              className="flex items-center space-x-2"
            >
              <Camera size={16} />
              <span>Featured</span>
            </Button>
          </div>
        </div>
      </section>

      {/* Gallery Grid */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          {filteredImages.length === 0 ? (
            <div className="text-center py-16">
              <Camera size={64} className="mx-auto text-muted-foreground mb-4" />
              <h3 className="text-2xl font-bold text-foreground mb-2">No Images Found</h3>
              <p className="text-muted-foreground">Gallery images will appear here once they are uploaded.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredImages.map((image, index) => (
                <Card 
                  key={image.id}
                  className="group overflow-hidden hover:shadow-corporate transition-all duration-300 cursor-pointer animate-fade-in border-card-border"
                  style={{ animationDelay: `${index * 0.1}s` }}
                  onClick={() => setSelectedImage(image)}
                >
                  <CardContent className="p-0 relative">
                    <div className="aspect-square overflow-hidden">
                      <img
                        src={image.image_url}
                        alt={image.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300 flex items-center justify-center">
                        <ZoomIn className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" size={32} />
                      </div>
                      {image.is_featured && (
                        <div className="absolute top-2 right-2 bg-accent text-accent-foreground px-2 py-1 rounded-full text-xs font-medium">
                          Featured
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                        {image.title}
                      </h3>
                      {image.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {image.description}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Image Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="max-w-4xl max-h-full bg-background rounded-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="aspect-video">
              <img
                src={selectedImage.image_url}
                alt={selectedImage.title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-6">
              <h2 className="text-2xl font-bold text-foreground mb-2">{selectedImage.title}</h2>
              {selectedImage.description && (
                <p className="text-muted-foreground">{selectedImage.description}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Gallery;