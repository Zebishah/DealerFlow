import React, { useState } from 'react';
import { Heart } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { NormalizedCar } from '../types';

interface CarCardProps {
    car: NormalizedCar;
    onSave: () => void;
    isSaved: boolean;
}

// Color themes for each source
const SOURCE_COLORS: Record<string, { badge: string; border: string; accent: string }> = {
    autotrader: {
        badge: 'bg-sky-800 text-white',
        border: 'border-l-4 border-l-blue-600',
        accent: 'hover:border-blue-300'
    },
    autoplanet: {
        badge: 'bg-purple-600 text-white',
        border: 'border-l-4 border-l-purple-600',
        accent: 'hover:border-purple-300'
    },
    humberview: {
        badge: 'bg-emerald-600 text-white',
        border: 'border-l-4 border-l-emerald-600',
        accent: 'hover:border-emerald-300'
    },
};

// Default fallback colors
const DEFAULT_COLORS = {
    badge: 'bg-gray-600 text-white',
    border: 'border-l-4 border-l-gray-600',
    accent: 'hover:border-gray-300'
};

export const CarCard: React.FC<CarCardProps> = ({ car, onSave, isSaved }) => {
    const [imgError, setImgError] = useState(false);

    // Get color scheme for this source
    const colors = SOURCE_COLORS[car.source.toLowerCase()] || DEFAULT_COLORS;

    return (
        <Card className="overflow-hidden hover:shadow-lg transition-shadow flex flex-col">
            <div className="relative">
                <img
                    src={imgError ? '/placeholder.jpg' : car.image}
                    alt={car.title}
                    onError={() => setImgError(true)}
                    className="w-full h-48 object-cover"
                />
                <button
                    onClick={onSave}
                    className={`absolute top-2 right-2 p-2 rounded-full ${isSaved ? 'bg-red-500 text-white' : 'bg-white text-gray-700'
                        } hover:scale-110 transition-transform shadow-md`}
                >
                    <Heart className="h-5 w-5" fill={isSaved ? 'currentColor' : 'none'} />
                </button>
                <div className={`absolute top-2 left-2 ${colors.badge} px-3 py-1 rounded-md text-xs font-semibold uppercase shadow-md`}>
                    {car.source}
                </div>
            </div>
            <CardContent className="p-4 flex flex-col flex-1">
                <h3 className="font-bold text-lg mb-2 line-clamp-2">{car.title}</h3>
                <p className="text-2xl font-bold text-green-600 mb-2">{car.price}</p>

                {/* Reserve space for optional fields */}
                <div className="space-y-1 text-sm text-gray-600 mb-3 min-h-[4.5rem]">
                    {car.year && <p>Year: {car.year}</p>}
                    {car.odometer && <p>Mileage: {car.odometer}</p>}
                    {car.location && <p>Location: {car.location}</p>}

                    {/* Fill empty space if fields are missing */}
                    {!car.year && <p className="invisible">Year</p>}
                    {!car.odometer && <p className="invisible">Mileage</p>}
                    {!car.location && <p className="invisible">Location</p>}
                </div>

                <a
                    href={car.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-auto block w-full text-center bg-sky-800 text-white py-2 rounded hover:bg-sky-900 transition-colors font-medium"
                >
                    View Listing
                </a>
            </CardContent>
        </Card>
    );
};