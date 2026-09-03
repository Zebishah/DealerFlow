"use client"

import type React from "react"
import { useState } from "react"
import { Car, ChevronDown, ChevronUp, X, RotateCcw, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useMakesModels } from "../contexts/MakesModelsContext"
import { FILTERS } from "../config/filters"
import toast from "react-hot-toast"

interface FilterPanelProps {
    onSearch: (filters: Record<string, any>) => void
    isPending: boolean
}

export const FilterPanel: React.FC<FilterPanelProps> = ({ onSearch, isPending }) => {
    const makesModels = useMakesModels()
    const defaultFilters = Object.fromEntries(
        FILTERS.map((f) => [f.key, f.default ?? ""])
    )
    const [filters, setFilters] = useState<Record<string, any>>({
        ...defaultFilters,
        radius: 100,
    })
    const [isExpanded, setIsExpanded] = useState(true)

    const handleChange = (key: string, value: any) => {
        setFilters((prev) => {
            const updated = { ...prev, [key]: value }
            if (key === "make") updated.model = ""
            return updated
        })
    }

    const handleSubmit = () => {
        if (!filters.postal) {
            toast.error("Postal code is required")
            return
        }
        onSearch(filters)
    }

    const handleClearFilter = (key: string) => {
        setFilters((prev) => {
            const updated = { ...prev }
            const filter = FILTERS.find((f) => f.key === key)
            updated[key] = filter?.default ?? ""
            if (key === "make") updated.model = ""
            return updated
        })
    }

    const handleClearAll = () => {
        setFilters({
            ...defaultFilters,
            radius: 100,
        })
        toast.success("All filters cleared")
    }

    const hasActiveFilters = () => {
        return Object.entries(filters).some(([key, value]) => {
            const filter = FILTERS.find((f) => f.key === key)
            const defaultValue = filter?.default ?? ""
            return value !== defaultValue && value !== "" && key !== "radius"
        })
    }

    const makes = Object.keys(makesModels).sort()
    const models = filters.make ? makesModels[filters.make as keyof typeof makesModels] || [] : []

    return (
        <Card className="mb-6 border-0 shadow-lg bg-gradient-to-br from-slate-50 to-slate-100">
            <CardHeader
                className="pb-4 border-b border-slate-200 cursor-pointer hover:bg-slate-50/50 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <CardTitle className="flex items-center justify-between text-lg font-semibold text-slate-900">
                    <div className="flex items-center">
                        <Car className="mr-2 h-5 w-5 text-blue-600" />
                        Search Vehicles
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-slate-200/50"
                        onClick={(e) => {
                            e.stopPropagation()
                            setIsExpanded(!isExpanded)
                        }}
                    >
                        {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-slate-600" />
                        ) : (
                            <ChevronDown className="h-4 w-4 text-slate-600" />
                        )}
                    </Button>
                </CardTitle>
            </CardHeader>

            {isExpanded && (
                <CardContent className="pt-6">
                    <div className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {FILTERS.map((filter) => {
                                const hasValue = filters[filter.key] && filters[filter.key] !== (filter.default ?? "")

                                if (filter.key === "make") {
                                    return (
                                        <div key={filter.key} className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <label className="block text-sm font-semibold text-slate-700">{filter.label}</label>
                                                {hasValue && (
                                                    <button
                                                        onClick={() => handleClearFilter(filter.key)}
                                                        className="text-xs text-slate-500 hover:text-red-600 transition-colors flex items-center gap-1"
                                                        title="Clear this filter"
                                                    >
                                                        <X className="h-3 w-3" />
                                                        Clear
                                                    </button>
                                                )}
                                            </div>
                                            <Select
                                                value={filters[filter.key] || ""}
                                                onValueChange={(value) => handleChange(filter.key, value)}
                                            >
                                                <SelectTrigger className="bg-white border border-slate-300 focus:ring-0 focus:outline-none hover:border-blue-400 transition-colors">
                                                    <SelectValue placeholder={filter.placeholder} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {makes.map((make) => (
                                                        <SelectItem key={make} value={make}>
                                                            {make}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )
                                }

                                if (filter.key === "model") {
                                    return (
                                        <div key={filter.key} className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <label className="block text-sm font-semibold text-slate-700">{filter.label}</label>
                                                {hasValue && (
                                                    <button
                                                        onClick={() => handleClearFilter(filter.key)}
                                                        className="text-xs text-slate-500 hover:text-red-600 transition-colors flex items-center gap-1"
                                                        title="Clear this filter"
                                                    >
                                                        <X className="h-3 w-3" />
                                                        Clear
                                                    </button>
                                                )}
                                            </div>
                                            <Select
                                                value={filters[filter.key] || ""}
                                                onValueChange={(value) => handleChange(filter.key, value)}
                                                disabled={!filters.make}
                                            >
                                                <SelectTrigger className="bg-white border border-slate-300 focus:ring-0 focus:outline-none hover:border-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                                    <SelectValue placeholder={filter.placeholder} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {models.map((model) => (
                                                        <SelectItem key={model} value={model}>
                                                            {model}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )
                                }

                                if (filter.type === "select" && Array.isArray(filter.options)) {
                                    return (
                                        <div key={filter.key} className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <label className="block text-sm font-semibold text-slate-700">{filter.label}</label>
                                                {hasValue && (
                                                    <button
                                                        onClick={() => handleClearFilter(filter.key)}
                                                        className="text-xs text-slate-500 hover:text-red-600 transition-colors flex items-center gap-1"
                                                        title="Clear this filter"
                                                    >
                                                        <X className="h-3 w-3" />
                                                        Clear
                                                    </button>
                                                )}
                                            </div>
                                            <Select
                                                value={filters[filter.key] || filter.default || ""}
                                                onValueChange={(value) => handleChange(filter.key, value)}
                                            >
                                                <SelectTrigger className="bg-white border border-slate-300 focus:ring-0 focus:outline-none hover:border-blue-400 transition-colors">
                                                    <SelectValue placeholder={filter.label} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {filter.options.map((opt) => (
                                                        <SelectItem key={opt} value={opt}>
                                                            {opt}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )
                                }

                                return (
                                    <div key={filter.key} className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="block text-sm font-semibold text-slate-700">
                                                {filter.label}
                                                {filter.required && <span className="text-red-500 ml-1">*</span>}
                                            </label>
                                            {hasValue && !filter.required && (
                                                <button
                                                    onClick={() => handleClearFilter(filter.key)}
                                                    className="text-xs text-slate-500 hover:text-red-600 transition-colors flex items-center gap-1"
                                                    title="Clear this filter"
                                                >
                                                    <X className="h-3 w-3" />
                                                    Clear
                                                </button>
                                            )}
                                        </div>
                                        <Input
                                            type={filter.type}
                                            placeholder={filter.placeholder}
                                            value={filters[filter.key] || ""}
                                            onChange={(e) => handleChange(filter.key, e.target.value)}
                                            defaultValue={filter?.default}
                                            min={filter.min}
                                            max={filter.max}
                                            required={filter.required}
                                            className="bg-white border border-slate-300 focus:ring-0 focus:outline-none hover:border-blue-400 focus:border-blue-500 transition-colors"
                                        />
                                    </div>
                                )
                            })}
                        </div>

                        <div className="flex flex-wrap gap-3 pt-2">
                            <Button
                                onClick={handleSubmit}
                                disabled={isPending}
                                className="flex-1 md:flex-none bg-sky-800 hover:bg-sky-900 text-white font-semibold py-2 h-10 rounded-lg transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Searching...
                                    </>
                                ) : (
                                    <>
                                        <Car className="mr-2 h-4 w-4" />
                                        Search Cars
                                    </>
                                )}
                            </Button>
                            {hasActiveFilters() && (
                                <Button
                                    onClick={handleClearAll}
                                    variant="outline"
                                    className="flex-1 md:flex-none border-slate-300 hover:bg-red-50 hover:border-red-300 hover:text-red-700 font-semibold py-2 h-10 rounded-lg transition-colors"
                                >
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    Clear All Filters
                                </Button>
                            )}
                        </div>
                    </div>
                </CardContent>
            )}
        </Card>
    )
}