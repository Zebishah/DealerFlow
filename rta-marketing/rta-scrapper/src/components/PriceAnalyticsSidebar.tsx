// src/components/PriceAnalyticsSidebar.tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TrendingDown, TrendingUp, DollarSign, MapPin } from 'lucide-react';
import { NormalizedCar } from '@/types';

interface PriceAnalyticsSidebarProps {
    cars: NormalizedCar[];
}

export const PriceAnalyticsSidebar: React.FC<PriceAnalyticsSidebarProps> = ({ cars }) => {
    if (cars.length === 0) return null;

    // Extract price + source safely
    const pricedCars = cars
        .map((car) => {
            const match = car.price.match(/[\d,]+(\.\d+)?/);
            const price = match ? parseFloat(match[0].replace(/,/g, '')) : null;
            return price !== null ? { ...car, priceNum: price } : null;
        })
        .filter((c): c is NonNullable<typeof c> => c !== null);

    if (pricedCars.length === 0) return null;

    // --- Basic Stats ---
    const prices = pricedCars.map((c) => c.priceNum);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;


    // --- Highest / Lowest by Site ---
    const highest = pricedCars.reduce((best, car) =>
        car.priceNum > (best?.priceNum ?? -Infinity) ? car : best
    );
    const lowest = pricedCars.reduce((best, car) =>
        car.priceNum < (best?.priceNum ?? Infinity) ? car : best
    );


    // --- Distribution Buckets ---
    const buckets = [
        { label: 'Under $25K', max: 25000 },
        { label: '$25K–$35K', min: 25000, max: 35000 },
        { label: '$35K–$45K', min: 35000, max: 45000 },
        { label: 'Over $45K', min: 45000 },
    ];

    const distribution = buckets.map((bucket) => {
        const count = prices.filter(
            (p) =>
                (!bucket.min || p >= bucket.min) && (!bucket.max || p <= bucket.max)
        ).length;
        return { ...bucket, count, percentage: (count / prices.length) * 100 };
    });

    return (
        <TooltipProvider>
            <div className="sticky top-24 space-y-4">
                {/* === Price Insights === */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <DollarSign className="h-5 w-5 text-green-600" />
                            Price Insights
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                        {/* Average */}
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Average</span>
                            <span className="font-semibold">${avgPrice.toFixed(0)}</span>
                        </div>

                        {/* Highest Price + Site */}
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Highest</span>
                            <div className="flex items-center gap-1.5">
                                <Badge variant="outline" className="text-xs">
                                    <TrendingUp className="h-3 w-3 mr-1 text-red-600" />
                                    ${highest.priceNum.toFixed(0)}
                                </Badge>
                                <Tooltip>
                                    <TooltipTrigger>
                                        <Badge variant="secondary" className="text-xs capitalize">
                                            <MapPin className="h-3 w-3 mr-1" />
                                            {highest.source}
                                        </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Highest price from {highest.source}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                        </div>

                        {/* Lowest Price + Site */}
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Lowest</span>
                            <div className="flex items-center gap-1.5">
                                <Badge variant="outline" className="text-xs">
                                    <TrendingDown className="h-3 w-3 mr-1 text-green-600" />
                                    ${lowest.priceNum.toFixed(0)}
                                </Badge>
                                <Tooltip>
                                    <TooltipTrigger>
                                        <Badge variant="secondary" className="text-xs capitalize">
                                            <MapPin className="h-3 w-3 mr-1" />
                                            {lowest.source}
                                        </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Lowest price from {lowest.source}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                        </div>

                    </CardContent>
                </Card>

                {/* === Price Distribution === */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Price Distribution</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {distribution.map((bucket) => (
                            <div key={bucket.label} className="space-y-1">
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">{bucket.label}</span>
                                    <span className="font-medium">{bucket.count}</span>
                                </div>
                                <Progress value={bucket.percentage} className="h-2" />
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>
        </TooltipProvider>
    );
};