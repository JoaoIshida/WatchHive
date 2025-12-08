"use client";
import { useState, useEffect, useRef, useCallback } from 'react';

const RangeSlider = ({ min = 0, max = 240, step = 5, valueMin, valueMax, onChange, formatLabel }) => {
    const [minVal, setMinVal] = useState(valueMin !== undefined ? valueMin : min);
    const [maxVal, setMaxVal] = useState(valueMax !== undefined ? valueMax : max);
    const [isInitialized, setIsInitialized] = useState(false);
    const minValRef = useRef(null);
    const maxValRef = useRef(null);
    const range = useRef(null);
    const containerRef = useRef(null);
    const isDraggingRef = useRef(false);

    // Convert to percentage
    const getPercent = useCallback((value) => Math.round(((value - min) / (max - min)) * 100), [min, max]);

    // Update range bar position
    const updateRangeBar = useCallback(() => {
        if (range.current) {
            const minPercent = getPercent(minVal);
            const maxPercent = getPercent(maxVal);
            range.current.style.left = `${minPercent}%`;
            range.current.style.width = `${maxPercent - minPercent}%`;
        }
    }, [minVal, maxVal, getPercent]);

    // Initialize on mount
    useEffect(() => {
        setIsInitialized(true);
        updateRangeBar();
    }, [updateRangeBar]);

    // Update range bar when values change
    useEffect(() => {
        updateRangeBar();
    }, [minVal, maxVal, updateRangeBar]);

    // Sync with external values
    useEffect(() => {
        if (valueMin !== undefined && valueMin !== minVal) {
            setMinVal(valueMin);
        }
    }, [valueMin]);

    useEffect(() => {
        if (valueMax !== undefined && valueMax !== maxVal) {
            setMaxVal(valueMax);
        }
    }, [valueMax]);

    // Handle global mouse up to catch cases where user releases outside the slider
    useEffect(() => {
        const handleGlobalMouseUp = () => {
            if (isDraggingRef.current) {
                onChange({ min: minVal, max: maxVal });
                isDraggingRef.current = false;
            }
        };

        const handleGlobalTouchEnd = () => {
            if (isDraggingRef.current) {
                onChange({ min: minVal, max: maxVal });
                isDraggingRef.current = false;
            }
        };

        window.addEventListener('mouseup', handleGlobalMouseUp);
        window.addEventListener('touchend', handleGlobalTouchEnd);

        return () => {
            window.removeEventListener('mouseup', handleGlobalMouseUp);
            window.removeEventListener('touchend', handleGlobalTouchEnd);
        };
    }, [minVal, maxVal, onChange]);

    return (
        <div className="w-full" ref={containerRef}>
            <div className="relative h-8">
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={minVal}
                    ref={minValRef}
                    onChange={(event) => {
                        const value = Math.min(+event.target.value, maxVal - step);
                        setMinVal(value);
                        event.target.value = value.toString();
                        // Call onChange immediately for real-time filtering
                        if (!isDraggingRef.current) {
                            onChange({ min: value, max: maxVal });
                        }
                    }}
                    onMouseDown={() => {
                        isDraggingRef.current = true;
                    }}
                    onMouseUp={(event) => {
                        if (isDraggingRef.current) {
                            const value = Math.min(+event.target.value, maxVal - step);
                            onChange({ min: value, max: maxVal });
                            isDraggingRef.current = false;
                        }
                    }}
                    onTouchStart={() => {
                        isDraggingRef.current = true;
                    }}
                    onTouchEnd={(event) => {
                        if (isDraggingRef.current) {
                            const value = Math.min(+event.target.value, maxVal - step);
                            onChange({ min: value, max: maxVal });
                            isDraggingRef.current = false;
                        }
                    }}
                    className="absolute w-full h-0 z-20 opacity-0 cursor-pointer"
                    style={{ zIndex: minVal > max - 100 ? '20' : '10' }}
                />
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={maxVal}
                    ref={maxValRef}
                    onChange={(event) => {
                        const value = Math.max(+event.target.value, minVal + step);
                        setMaxVal(value);
                        event.target.value = value.toString();
                        // Call onChange immediately for real-time filtering
                        if (!isDraggingRef.current) {
                            onChange({ min: minVal, max: value });
                        }
                    }}
                    onMouseDown={() => {
                        isDraggingRef.current = true;
                    }}
                    onMouseUp={(event) => {
                        if (isDraggingRef.current) {
                            const value = Math.max(+event.target.value, minVal + step);
                            onChange({ min: minVal, max: value });
                            isDraggingRef.current = false;
                        }
                    }}
                    onTouchStart={() => {
                        isDraggingRef.current = true;
                    }}
                    onTouchEnd={(event) => {
                        if (isDraggingRef.current) {
                            const value = Math.max(+event.target.value, minVal + step);
                            onChange({ min: minVal, max: value });
                            isDraggingRef.current = false;
                        }
                    }}
                    className="absolute w-full h-0 z-20 opacity-0 cursor-pointer"
                />
                <div className="relative w-full h-2">
                    <div className="absolute w-full h-2 bg-futuristic-blue-800/60 rounded-full"></div>
                    <div
                        ref={range}
                        className="absolute h-2 bg-futuristic-yellow-500 rounded-full"
                    ></div>
                    <div
                        className="absolute w-4 h-4 bg-futuristic-yellow-500 border-2 border-futuristic-blue-900 rounded-full shadow-glow-yellow cursor-pointer hover:scale-110 transition-transform"
                        style={{ left: `calc(${getPercent(minVal)}% - 8px)`, top: '-4px' }}
                    ></div>
                    <div
                        className="absolute w-4 h-4 bg-futuristic-yellow-500 border-2 border-futuristic-blue-900 rounded-full shadow-glow-yellow cursor-pointer hover:scale-110 transition-transform"
                        style={{ left: `calc(${getPercent(maxVal)}% - 8px)`, top: '-4px' }}
                    ></div>
                </div>
            </div>
            <div className="flex justify-between mt-3 text-xs text-futuristic-yellow-400/80 font-medium">
                <span>{formatLabel ? formatLabel(minVal) : `${minVal} min`}</span>
                <span>{formatLabel ? formatLabel(maxVal) : `${maxVal} min`}</span>
            </div>
        </div>
    );
};

export default RangeSlider;

