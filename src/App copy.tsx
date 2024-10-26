import React, { useState, useEffect, useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Product {
  title: string;
  imgUrl: string;
}

interface ProductCardProps {
  product: Product;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => (
  <div className="flex flex-col items-center p-4 bg-white rounded-lg shadow-md">
    <img src={product.imgUrl} alt={product.title} className="w-24 h-24 object-cover mb-2 rounded" />
    <h3 className="text-sm font-semibold text-center">{product.title}</h3>
  </div>
);

const VIEWPORT_SIZE = 4;
const BUFFER_SIZE = 4;

interface NavigationButtonProps {
  direction: "prev" | "next";
  onClick: () => void;
  disabled: boolean;
}

const NavigationButton: React.FC<NavigationButtonProps> = ({ direction, onClick, disabled }) => {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;

  return (
    <button
      className={`
        hidden md:flex items-center justify-center
        w-10 h-10 rounded-full bg-white shadow-md
        text-gray-600 hover:text-gray-900 
        transition-colors duration-200
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
        disabled:opacity-50 disabled:cursor-not-allowed
        absolute top-1/2 transform -translate-y-1/2
        ${direction === "prev" ? "-left-5" : "-right-5"}
        z-10
      `}
      onClick={onClick}
      disabled={disabled}
      aria-label={`${direction === "prev" ? "Previous" : "Next"} slide`}
    >
      <Icon size={24} />
    </button>
  );
};

interface HorizontalCarouselProps {
  products: Product[];
}

const HorizontalCarousel: React.FC<HorizontalCarouselProps> = ({ products = [] }) => {
  const [viewportRef, emblaApi] = useEmblaCarousel({
    // loop: true,
    align: "start",
    containScroll: false,
    duration: 20,
    skipSnaps: false,
  });

  const [visibleSlides, setVisibleSlides] = useState<Product[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  const normalizeIndex = (index: number, length: number): number => {
    let r = 0;
    if (length === 0) r = 0;
    else r = (index + length) % length;

    return r;
  };

  const getVisibleSlides = useCallback(() => {
    const clone = [...products];

    if (!emblaApi || !isInitialized || clone.length === 0) {
      return products.slice(0, VIEWPORT_SIZE + BUFFER_SIZE);
    }

    try {
      const selectedIndex = emblaApi.selectedScrollSnap();
      console.log("selectedIndex: ", selectedIndex);

      const totalSlides = products.length;

      const startIndex = normalizeIndex(selectedIndex - BUFFER_SIZE, totalSlides);

      const endIndex = normalizeIndex(selectedIndex + VIEWPORT_SIZE + BUFFER_SIZE, totalSlides);

      if (endIndex <= startIndex) {
        return [...clone.slice(startIndex), ...clone.slice(0, endIndex)];
      }

      return clone.slice(startIndex, endIndex);
    } catch (error) {
      return clone.slice(0, VIEWPORT_SIZE + BUFFER_SIZE);
    }
  }, [emblaApi, isInitialized, products]);

  const updateVisibleSlides = useCallback(() => {
    const slides = getVisibleSlides();

    const updatedSlides = slides.map((product, index) => ({
      ...product,
      key: `${product.title}-${index}-${Date.now()}`,
    }));
    setVisibleSlides(updatedSlides);
  }, [getVisibleSlides]);

  useEffect(() => {
    if (!emblaApi) return;

    const onInit = () => {
      setIsInitialized(true);
      updateVisibleSlides();
    };

    const onSelect = () => {
      if (isInitialized) updateVisibleSlides();
    };

    emblaApi.on("init", onInit);
    emblaApi.on("select", onSelect);

    if (emblaApi.internalEngine()) {
      onInit();
    }

    return () => {
      emblaApi.off("init", onInit);
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, isInitialized]);

  if (products.length === 0) return null;

  return (
    <div className="relative">
      <div className="overflow-hidden" ref={viewportRef}>
        <div className="flex gap-4">
          {visibleSlides.map((product) => (
            <div className="flex-none w-40">
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      </div>

      <NavigationButton direction="prev" onClick={scrollPrev} disabled={!isInitialized} />
      <NavigationButton direction="next" onClick={scrollNext} disabled={!isInitialized} />

      <div className="md:hidden text-sm text-gray-500 text-center mt-4">Swipe to navigate</div>
    </div>
  );
};

const generateData = (count: number): Product[] => {
  return Array.from({ length: count }, (_, i) => ({
    title: `Product ${i + 1}`,
    imgUrl: `/api/placeholder/150/150`,
  }));
};

const App: React.FC = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-100">
    <div className="w-full max-w-4xl p-4">
      <HorizontalCarousel products={generateData(52)} />
    </div>
  </div>
);

export default App;
