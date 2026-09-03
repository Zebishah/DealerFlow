// ============================================
// FILE: src/contexts/MakesModelsContext.tsx
// ============================================

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { MakesModelsData } from '../types/index';

const MakesModelsContext = createContext<MakesModelsData>({});

export const useMakesModels = () => useContext(MakesModelsContext);

interface MakesModelsProviderProps {
    children: ReactNode;
}

export const MakesModelsProvider: React.FC<MakesModelsProviderProps> = ({ children }) => {
    const [makesModels, setMakesModels] = useState<MakesModelsData>({
        "Abarth": ["500", "595", "600", "Grande Punto"],
        "Acura": ["CL", "CSX", "ILX", "Integra", "MDX", "NSX", "RDX", "TL", "TLX"],
        "Alfa Romeo": ["4C", "Giulia", "Giulietta", "Stelvio", "Tonale"],
        "Audi": ["A3", "A4", "A5", "A6", "Q3", "Q5", "Q7", "Q8"],
        "BMW": ["1 Series", "2 Series", "3 Series", "4 Series", "5 Series", "X1", "X3", "X5"],
        "Chevrolet": ["Blazer", "Camaro", "Colorado", "Corvette", "Equinox", "Silverado", "Tahoe"],
        "Ford": ["Bronco", "Edge", "Escape", "Explorer", "F-150", "Mustang", "Ranger"],
        "Honda": ["Accord", "Civic", "CR-V", "Fit", "HR-V", "Odyssey", "Pilot"],
        "Hyundai": ["Elantra", "Kona", "Palisade", "Santa Fe", "Sonata", "Tucson"],
        "Mazda": ["CX-3", "CX-5", "CX-9", "Mazda3", "Mazda6", "MX-5"],
        "Mercedes-Benz": ["A-Class", "C-Class", "E-Class", "GLA", "GLC", "GLE"],
        "Toyota": ["4Runner", "Camry", "Corolla", "Highlander", "RAV4", "Tacoma", "Tundra"]
    });

    // Optional: Load from public/makes-models.json
    useEffect(() => {
        fetch('/makes-models.json')
            .then(res => res.json())
            .then(data => setMakesModels(data))
            .catch(_err => console.log('Using default makes/models data'));
    }, []);

    return (
        <MakesModelsContext.Provider value={makesModels}>
            {children}
        </MakesModelsContext.Provider>
    );
};

