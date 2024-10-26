import React, { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import throttle from "lodash.throttle";

// Core types
interface Item {
  id: string | number;
  [key: string]: any;
}

interface ResponsiveBreakpoint {
  width: number;
  items: number;
}

interface Breakpoints {
  large?: number;
  medium?: number;
  small?: number;
}

interface SliderConfig {
  peek?: boolean;
  peekAmount?: number | string;
  gap: number;
  showArrows?: boolean;
  arrowPosition?: "inside" | "outside";
  arrowSize?: "small" | "medium" | "large";
  enableDrag?: boolean;
  dragThreshold: number;
  breakpoints?: Breakpoints;
  springConfig: {
    stiffness: number;
    damping: number;
    mass: number;
  };
  virtualization?: {
    enabled: boolean;
    overscan?: number;
  };
  responsiveBreakpoints?: ResponsiveBreakpoint[];
}

interface SliderProps<T extends Item> {
  items: T[];
  // renderItem: (item: T, index: number) => React.ReactNode;
  config?: Partial<SliderConfig>;
  onSlideChange?: (currentIndex: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  defaultIndex?: number;
  className?: string;
  component: any;
}

export interface SliderRef {
  scrollToItem: (itemId: string | number) => void;
  scrollToIndex: (index: number) => void;
  next: () => void;
  previous: () => void;
  getCurrentIndex: () => number;
  refresh: () => void;
}

const defaultConfig: SliderConfig = {
  peek: false,
  peekAmount: "20%",
  gap: 24,
  showArrows: true,
  arrowPosition: "inside",
  arrowSize: "medium",
  enableDrag: true,
  dragThreshold: 0.2,
  breakpoints: {
    large: 4,
    medium: 3,
    small: 1,
  },
  springConfig: {
    stiffness: 150,
    damping: 25,
    mass: 1,
  },
  virtualization: {
    enabled: true,
    overscan: 2,
  },
};

const getVisibleItemsEnhanced = (width: number, breakpoints?: Breakpoints, responsiveBreakpoints?: ResponsiveBreakpoint[]) => {
  if (responsiveBreakpoints?.length) {
    const sortedBreakpoints = [...responsiveBreakpoints].sort((a, b) => b.width - a.width);
    const matchingBreakpoint = sortedBreakpoints.find((bp) => width >= bp.width);
    if (matchingBreakpoint) {
      return matchingBreakpoint.items;
    }
    return sortedBreakpoints[sortedBreakpoints.length - 1]?.items ?? 1;
  }

  const defaultBreakpoints = {
    large: width >= 1280 ? 4 : 3,
    medium: width >= 768 ? 3 : 2,
    small: width >= 640 ? 2 : 1,
  };

  const mergedBreakpoints = { ...defaultBreakpoints, ...breakpoints };

  if (width >= 1280) return mergedBreakpoints.large ?? 4;
  if (width >= 1024) return mergedBreakpoints.large ?? 3;
  if (width >= 768) return mergedBreakpoints.medium ?? 3;
  if (width >= 640) return mergedBreakpoints.small ?? 2;
  return mergedBreakpoints.small ?? 1;
};

// Memoized Card Component
const CardWrapper = memo(({ item, onHeightChange }: { item: Item; itemWidth: number; onHeightChange: (id: string | number, height: number) => void; height: number }) => {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (cardRef.current) {
      onHeightChange(item.id, cardRef.current.offsetHeight);
    }
  }, [item.id, onHeightChange]);

  return (
    <div ref={cardRef} className="w-full" style={{}}>
      <div className="h-full flex flex-col bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl transform hover:-translate-y-1 hover:scale-[1.02]">
        <div className="relative w-full pt-[66.67%]">
          <img src={item.img} alt={item.title} className="absolute top-0 left-0 w-full h-full object-cover" loading="lazy" />
        </div>
        <div className="flex flex-col flex-grow p-6">
          <h3 className="text-xl font-bold mb-2 text-gray-800 dark:text-white">{item.title}</h3>
          <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed flex-grow">{item.content}</p>
          <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors" onClick={(e) => e.stopPropagation()}>
            Learn More
          </button>
        </div>
      </div>
    </div>
  );
});

CardWrapper.displayName = "CardWrapper";

// Memoized Arrow Button Component
const ArrowButton = memo(
  ({ direction, onClick, disabled, position, size }: { direction: "left" | "right"; onClick: () => void; disabled: boolean; position: "inside" | "outside"; size: "small" | "medium" | "large" }) => {
    const Arrow = direction === "left" ? ChevronLeft : ChevronRight;
    const sizeClass = {
      small: "w-4 h-4",
      medium: "w-6 h-6",
      large: "w-8 h-8",
    }[size];

    return (
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: disabled ? 0 : 1 }}
        exit={{ opacity: 0 }}
        className={`absolute top-1/2 transform -translate-y-1/2 bg-white/80 p-2 rounded-full 
        shadow-lg backdrop-blur-sm hover:bg-white/90 transition-colors disabled:opacity-50 
        disabled:cursor-not-allowed z-10 ${position === "inside" ? (direction === "left" ? "left-2" : "right-2") : direction === "left" ? "-left-4" : "-right-4"}`}
        onClick={onClick}
        disabled={disabled}
        aria-label={`${direction === "left" ? "Previous" : "Next"} slide`}
      >
        <Arrow className={sizeClass} />
      </motion.button>
    );
  }
);

ArrowButton.displayName = "ArrowButton";

// Main Slider Component
const DynamicSlider = forwardRef<SliderRef, SliderProps<Item>>((props, ref) => {
  const { component: Component, items, config = {}, onSlideChange, onDragStart, onDragEnd, defaultIndex = 0, className = "" } = props;

  const sliderConfig = { ...defaultConfig, ...config };
  const { peek, peekAmount, gap, showArrows, arrowPosition, arrowSize, enableDrag, dragThreshold, breakpoints, springConfig, virtualization, responsiveBreakpoints } = sliderConfig;

  // State declarations
  const [containerWidth, setContainerWidth] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(defaultIndex);
  const [isDragging, setIsDragging] = useState(false);
  const [visibleItems, setVisibleItems] = useState(breakpoints?.small ?? 1);
  const [sliderOffset, setSliderOffset] = useState(0);
  const [peekWidth, setPeekWidth] = useState(0);
  const [, setPreventScroll] = useState(false);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 0 });
  const [, setCardHeights] = useState<Record<string | number, number>>({});
  const [maxHeight, setMaxHeight] = useState(0);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef(0);
  const dragCurrentRef = useRef(0);
  const animationRef = useRef<number>(0);

  // Calculate peek width
  const calculatePeekWidth = useCallback(
    (width: number) => {
      if (!peek) return 0;
      if (typeof peekAmount === "number") return peekAmount;
      if (typeof peekAmount === "string" && peekAmount.endsWith("%")) {
        const itemWidth = (width - (visibleItems - 1) * gap) / visibleItems;
        return (itemWidth * parseFloat(peekAmount)) / 100;
      }
      return 0;
    },
    [peek, peekAmount, visibleItems, gap]
  );

  // Calculate item width
  const getItemWidth = useCallback(() => {
    if (!containerWidth) return 0;
    const peekSpace = peek ? peekWidth * 2 : 0;
    const availableWidth = containerWidth - peekSpace;
    return (availableWidth - gap * (visibleItems - 1)) / visibleItems;
  }, [containerWidth, peek, peekWidth, gap, visibleItems]);

  // Handle card height changes
  const handleCardHeightChange = useCallback((id: string | number, height: number) => {
    setCardHeights((prev) => {
      const newHeights = { ...prev, [id]: height };

      const maxHeight = Math.max(...Object.values(newHeights));
      setMaxHeight(maxHeight);
      return newHeights;
    });
  }, []);

  // Update dimensions
  useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = throttle(() => {
      const width = containerRef.current?.offsetWidth ?? 0;
      setContainerWidth(width);
      const newVisibleItems = getVisibleItemsEnhanced(width, breakpoints, responsiveBreakpoints);

      setVisibleItems(newVisibleItems);
      setPeekWidth(calculatePeekWidth(width));
    }, 16);

    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(containerRef.current);
    updateDimensions();

    return () => {
      resizeObserver.disconnect();
      updateDimensions.cancel();
      cancelAnimationFrame(animationRef.current);
    };
  }, [breakpoints, responsiveBreakpoints, calculatePeekWidth]);

  // Calculate visible range
  const calculateVisibleRange = useCallback(() => {
    if (!virtualization?.enabled) {
      return { start: 0, end: items.length };
    }

    const itemWidth = getItemWidth();

    const overscan = virtualization.overscan ?? 2;
    const visibleItemCount = Math.ceil(containerWidth / (itemWidth + gap));

    const startIndex = Math.max(0, Math.floor(-sliderOffset / (itemWidth + gap)) - overscan);
    const endIndex = Math.min(items.length, Math.ceil((-sliderOffset + containerWidth) / (itemWidth + gap)) + overscan);

    return {
      start: startIndex,
      end: endIndex,
    };
  }, [virtualization, sliderOffset, containerWidth, items.length, gap, getItemWidth]);

  // Update visible range
  useEffect(() => {
    if (virtualization?.enabled) {
      const range = calculateVisibleRange();
      setVisibleRange(range);
    }
  }, [sliderOffset, containerWidth, virtualization?.enabled, calculateVisibleRange]);

  // Animation
  const animateToOffset = useCallback(
    (targetOffset: number, immediate = false) => {
      if (immediate) {
        setSliderOffset(targetOffset);
        return;
      }

      const startOffset = sliderOffset;
      const distance = targetOffset - startOffset;
      const startTime = performance.now();

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / 300, 1);

        const springProgress = 1 - Math.exp((-springConfig.stiffness * progress) / springConfig.mass);
        const dampedProgress = springProgress * (1 - Math.exp(-springConfig.damping * progress));

        const newOffset = startOffset + distance * dampedProgress;
        setSliderOffset(newOffset);

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        }
      };

      cancelAnimationFrame(animationRef.current);
      animationRef.current = requestAnimationFrame(animate);
    },
    [sliderOffset, springConfig]
  );

  // Navigation handlers
  const handleNext = useCallback(() => {
    const itemWidth = getItemWidth();
    const maxIndex = items.length - visibleItems;
    const nextIndex = Math.min(maxIndex, currentIndex + 1);
    const targetOffset = -(nextIndex * (itemWidth + gap)) + (peek ? peekWidth : 0);

    setCurrentIndex(nextIndex);
    animateToOffset(targetOffset);
    onSlideChange?.(nextIndex);
  }, [getItemWidth, gap, visibleItems, items.length, currentIndex, peek, peekWidth, animateToOffset, onSlideChange]);

  const handlePrevious = useCallback(() => {
    const itemWidth = getItemWidth();
    const prevIndex = Math.max(0, currentIndex - 1);
    const targetOffset = -(prevIndex * (itemWidth + gap)) + (peek ? peekWidth : 0);

    setCurrentIndex(prevIndex);
    animateToOffset(targetOffset);
    onSlideChange?.(prevIndex);
  }, [getItemWidth, gap, currentIndex, peek, peekWidth, animateToOffset, onSlideChange]);

  // Drag handlers
  const handleDragStart = (event: React.MouseEvent | React.TouchEvent) => {
    if (!enableDrag) return;

    setIsDragging(true);
    setPreventScroll(true);
    const clientX = "touches" in event ? event.touches[0].clientX : event.clientX;
    dragStartRef.current = clientX;
    dragCurrentRef.current = clientX;

    cancelAnimationFrame(animationRef.current);
    onDragStart?.();
  };

  const handleDragMove = (event: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || !enableDrag) return;

    const clientX = "touches" in event ? event.touches[0].clientX : event.clientX;
    const deltaX = clientX - dragCurrentRef.current;
    dragCurrentRef.current = clientX;

    setSliderOffset((prev) => {
      const itemWidth = getItemWidth();
      const maxOffset = peek ? peekWidth : 0;
      const minOffset = -((items.length - visibleItems) * (itemWidth + gap)) + (peek ? peekWidth : 0);
      return Math.max(minOffset, Math.min(maxOffset, prev + deltaX));
    });

    event.preventDefault();
  };

  const handleDragEnd = () => {
    if (!isDragging || !enableDrag) return;

    setIsDragging(false);
    setPreventScroll(false);

    const totalDrag = dragCurrentRef.current - dragStartRef.current;
    const itemWidth = getItemWidth();

    if (Math.abs(totalDrag) > itemWidth * dragThreshold) {
      totalDrag > 0 ? handlePrevious() : handleNext();
    } else {
      const targetOffset = -(currentIndex * (itemWidth + gap)) + (peek ? peekWidth : 0);
      animateToOffset(targetOffset);
    }

    onDragEnd?.();
  };

  // Render virtualized items
  const renderVirtualizedItems = useCallback(() => {
    const itemWidth = getItemWidth();

    if (!virtualization?.enabled) {
      return items.map((item) => (
        <div key={item.id} id={String(item.id)} className="flex-shrink-0" style={{}}>
          <Component item={item} itemWidth={itemWidth} onHeightChange={handleCardHeightChange} height={maxHeight} />
        </div>
      ));
    }

    return items.slice(visibleRange.start, visibleRange.end).map((item, index) => (
      <div
        key={item.id}
        id={String(item.id)}
        className="flex-shrink-0"
        style={{
          width: itemWidth,
          transform: `translateX(${(index + visibleRange.start) * (itemWidth + gap)}px)`,
          position: "absolute",
          left: 0,
        }}
      >
        <Component item={item} itemWidth={itemWidth} onHeightChange={handleCardHeightChange} height={maxHeight} />
      </div>
    ));
  }, [items, virtualization?.enabled, visibleRange, getItemWidth, gap, maxHeight, handleCardHeightChange]);

  // Expose public API
  useImperativeHandle(ref, () => ({
    scrollToItem: (itemId) => {
      const itemIndex = items.findIndex((item) => item.id === itemId);
      if (itemIndex !== -1) {
        const itemWidth = getItemWidth();
        const targetOffset = -(itemIndex * (itemWidth + gap)) + (peek ? peekWidth : 0);
        setCurrentIndex(itemIndex);
        animateToOffset(targetOffset);
        onSlideChange?.(itemIndex);
      }
    },
    scrollToIndex: (index) => {
      const itemWidth = getItemWidth();
      const targetOffset = -(index * (itemWidth + gap)) + (peek ? peekWidth : 0);
      setCurrentIndex(index);
      animateToOffset(targetOffset);
      onSlideChange?.(index);
    },
    next: handleNext,
    previous: handlePrevious,
    getCurrentIndex: () => currentIndex,
    refresh: () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        setContainerWidth(width);
        const newVisibleItems = getVisibleItemsEnhanced(width, breakpoints, responsiveBreakpoints);
        setVisibleItems(newVisibleItems);
        setPeekWidth(calculatePeekWidth(width));
      }
    },
  }));

  if (!items?.length || !containerWidth) {
    return <div ref={containerRef} className={className} />;
  }

  return (
    <div className="relative w-full contain-layout">
      <div className={`overflow-x-clip ${className}`} onMouseEnter={() => setPreventScroll(true)} onMouseLeave={() => setPreventScroll(false)}>
        <div
          ref={containerRef}
          className="relative overflow-hidden w-full"
          style={{
            contain: "paint layout",
          }}
        >
          <motion.div
            className="flex relative items-center justify-center"
            style={{
              gap: `${gap}px`,
              touchAction: enableDrag ? "none" : "auto",
              userSelect: "none",
              height: maxHeight || "auto",
            }}
            animate={{ x: sliderOffset }}
            transition={{
              type: "spring",
              ...springConfig,
              duration: isDragging ? 0 : undefined,
            }}
            onMouseDown={handleDragStart}
            onMouseMove={handleDragMove}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd}
            onTouchStart={handleDragStart}
            onTouchMove={handleDragMove}
            onTouchEnd={handleDragEnd}
          >
            {renderVirtualizedItems()}
          </motion.div>
        </div>

        {showArrows && items.length > visibleItems && (
          <AnimatePresence>
            <ArrowButton direction="left" onClick={handlePrevious} disabled={currentIndex === 0} position={arrowPosition!} size={arrowSize!} />
            <ArrowButton direction="right" onClick={handleNext} disabled={currentIndex === items.length - visibleItems} position={arrowPosition!} size={arrowSize!} />
          </AnimatePresence>
        )}
      </div>
    </div>
  );
});

DynamicSlider.displayName = "DynamicSlider";

// Example usage
const ExampleUsage = () => {
  const sliderRef = useRef<SliderRef>(null);
  const [items] = useState(() =>
    Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      title: `Product ${i + 1}`,
      content: `Experience the innovation of Product ${i + 1}.`,
      img: "https://placehold.co/600x400",
    }))
  );

  const sliderConfig: Partial<SliderConfig> = {
    gap: 8,
    peek: true,
    peekAmount: "10%",
    breakpoints: {
      large: 4,
      medium: 3,
      small: 2,
    },
    showArrows: true,
    arrowPosition: "outside",
    enableDrag: true,
    dragThreshold: 0.2,
    virtualization: {
      enabled: true,
      overscan: 2,
    },
    springConfig: {
      stiffness: 150,
      damping: 25,
      mass: 2,
    },
  };

  return (
    <div className="w-full p-4 bg-gray-100 dark:bg-gray-900">
      <DynamicSlider component={CardWrapper} ref={sliderRef} items={items} config={sliderConfig} onSlideChange={(index) => {}} className="mb-8" />

      <div className="flex gap-4 justify-center">
        <button
          onClick={() => sliderRef.current?.previous()}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
            transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 
            focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        >
          Previous
        </button>
        <button
          onClick={() => sliderRef.current?.next()}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
            transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 
            focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default ExampleUsage;
