// src/components/SavedDrawer.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Search, Heart, MapPin, Calendar, Gauge, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SavedCar } from '../types';

interface SavedDrawerProps {
    savedCars: SavedCar[];
    onRemove: (id: string) => void;
    onClose: () => void;
}

export const SavedDrawer: React.FC<SavedDrawerProps> = ({
    savedCars,
    onRemove,
    onClose,
}) => {
    const [search, setSearch] = useState('');
    const drawerRef = useRef<HTMLDivElement>(null);

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    // Filter logic (client-side)
    const filtered = savedCars.filter((car) => {
        const term = search.toLowerCase();
        return (
            car.title.toLowerCase().includes(term) ||
            car.price.toLowerCase().includes(term) ||
            (car.year?.toString() ?? '').includes(term) ||
            (car.odometer ?? '').toLowerCase().includes(term) ||
            (car.location ?? '').toLowerCase().includes(term)
        );
    });

    return (
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-end"
            onClick={onClose}
        >
            {/* Drawer panel */}
            <div
                ref={drawerRef}
                className="bg-background w-full max-w-md h-full overflow-y-auto shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 bg-background border-b p-4 flex items-center justify-between gap-4">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <Heart className="h-5 w-5 text-red-500" />
                        Saved Cars
                        <span className="text-muted-foreground">({savedCars.length})</span>
                    </h2>
                    <Button size="icon" variant="ghost" onClick={onClose}>
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                {/* Search */}
                <div className="p-4 border-b">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search saved cars…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {filtered.length === 0 ? (
                        <EmptyState search={search} total={savedCars.length} />
                    ) : (
                        <div className="space-y-4">
                            {filtered.map((car) => (
                                <SavedCarItem key={car.firestoreId} car={car} onRemove={onRemove} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

/* -------------------------------------------------------------------------- */
/* Mini component – same look as main CarCard but compact for drawer        */
/* -------------------------------------------------------------------------- */
const SavedCarItem: React.FC<{ car: SavedCar; onRemove: (id: string) => void }> = ({
    car,
    onRemove,
}) => {
    return (
        <Card className="overflow-hidden hover:shadow-md transition-shadow">
            <div className="flex">
                {/* Image */}
                <div className="relative w-28 h-28 bg-gray-100 flex-shrink-0">
                    <img
                        src={car.image}
                        alt={car.title}
                        className="h-full w-full object-cover"
                    />
                    <Badge className="absolute top-1 left-1 text-[10px] font-medium">
                        {car.source}
                    </Badge>
                </div>

                {/* Info */}
                <CardContent className="flex-1 p-3 flex flex-col justify-between">
                    <div>
                        <h3 className="font-medium text-sm line-clamp-2">{car.title}</h3>
                        <p className="text-lg font-bold text-green-600 mt-1">{car.price}</p>

                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mt-2">
                            {car.year && (
                                <div className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {car.year}
                                </div>
                            )}
                            {car.odometer && (
                                <div className="flex items-center gap-1">
                                    <Gauge className="h-3 w-3" />
                                    {car.odometer}
                                </div>
                            )}
                            {car.location && (
                                <div className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    <span className="truncate max-w-[100px]">{car.location}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-2 mt-3">
                        <Button
                            asChild
                            size="sm"
                            className="flex-1 h-8 text-xs"
                        >
                            <a
                                href={car.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-1"
                            >
                                <ExternalLink className="h-3 w-3" />
                                Visit
                            </a>
                        </Button>

                        <Button
                            size="sm"
                            variant="destructive"
                            className="h-8 text-xs"
                            onClick={() => onRemove(car.firestoreId!)}
                        >
                            Remove
                        </Button>
                    </div>
                </CardContent>
            </div>
        </Card>
    );
};

/* -------------------------------------------------------------------------- */
/* Empty state – friendly when nothing matches                               */
/* -------------------------------------------------------------------------- */
const EmptyState: React.FC<{ search: string; total: number }> = ({ search, total }) => {
    const isSearching = search.length > 0;
    return (
        <div className="text-center py-12">
            <Heart className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium text-foreground">
                {isSearching ? 'No matches' : 'No saved cars'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
                {isSearching
                    ? `Try adjusting your search term.`
                    : `Save cars from the main list to see them here.`}
            </p>
            {isSearching && total > 0 && (
                <p className="text-xs text-muted-foreground mt-4">
                    {total} car{total > 1 ? 's' : ''} in total.
                </p>
            )}
        </div>
    );
};