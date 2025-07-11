import React from 'react';
import { Card } from '../ui/card';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '../ui/carousel';
import { Dialog, DialogContent, DialogTrigger } from '../ui/dialog';
import { Expand } from 'lucide-react';

interface PhotoGalleryProps {
  images: string[];
  title: string;
}

const PhotoGallery: React.FC<PhotoGalleryProps> = ({ images, title }) => {
  const [selectedImage, setSelectedImage] = React.useState<string | null>(null);

  return (
    <Card className="overflow-hidden">
      <div className="relative">
        <Carousel className="w-full">
          <CarouselContent>
            {images.map((image, index) => (
              <CarouselItem key={index}>
                <div className="relative aspect-[16/10] overflow-hidden">
                  <img
                    src={image}
                    alt={`${title} - Image ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <Dialog>
                    <DialogTrigger asChild>
                      <button 
                        className="absolute top-4 right-4 bg-background/80 backdrop-blur-sm p-2 rounded-full hover:bg-background transition-colors"
                        onClick={() => setSelectedImage(image)}
                      >
                        <Expand className="w-5 h-5" />
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[90vh] p-0">
                      <img
                        src={selectedImage || image}
                        alt={`${title} - Full view`}
                        className="w-full h-full object-contain"
                      />
                    </DialogContent>
                  </Dialog>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="left-4" />
          <CarouselNext className="right-4" />
        </Carousel>
        
        {/* Image indicators */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
          {images.map((_, index) => (
            <div
              key={index}
              className="w-2 h-2 rounded-full bg-foreground/30"
            />
          ))}
        </div>
      </div>
    </Card>
  );
};

export default PhotoGallery;