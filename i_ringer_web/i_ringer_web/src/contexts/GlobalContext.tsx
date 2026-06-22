import React, { createContext, useContext, useState, ReactNode } from 'react'
import { dataProvider } from '../providers/dataProvider'

interface Hospital {
  id: number
  name: string
  address?: string
  phone?: string
  created_at?: string
  updated_at?: string
}

interface Ward {
  id: number
  name: string
  hospital_id: number
  created_at?: string
  updated_at?: string
}

interface Room {
  id: number
  room_number: string
  ward_id: number
  bed_count?: number
  created_at?: string
  updated_at?: string
}

interface GlobalContextType {
  hospitals: Hospital[]
  wards: Ward[]
  rooms: Room[]
  loadHospitals: () => Promise<void>
  loadWards: (hospitalId?: string) => Promise<void>
  loadRooms: (wardId?: string) => Promise<void>
  isLoading: boolean
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined)

export const useGlobalContext = () => {
  const context = useContext(GlobalContext)
  if (!context) {
    throw new Error('useGlobalContext must be used within GlobalProvider')
  }
  return context
}

interface GlobalProviderProps {
  children: ReactNode
}

export const GlobalProvider: React.FC<GlobalProviderProps> = ({ children }) => {
  const [hospitals, setHospitals] = useState<Hospital[]>([])
  const [wards, setWards] = useState<Ward[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const loadHospitalHierarchy = async () => {
    try {
      setIsLoading(true)
      const hierarchyData = await dataProvider.getHospitalHierarchy()
      // console.log('GlobalContext - hierarchy data:', hierarchyData)

      // 병원 리스트 추출
      const hospitalsData = hierarchyData.map((h: any) => ({
        id: h.id,
        name: h.name,
        created_at: h.created_at,
        updated_at: h.updated_at || h.udpated_at
      }))

      // 모든 병동 리스트 추출 (flat)
      const wardsData: Ward[] = []
      hierarchyData.forEach((hospital: any) => {
        if (hospital.wards && hospital.wards.length > 0) {
          hospital.wards.forEach((ward: any) => {
            wardsData.push({
              id: ward.id,
              hospital_id: ward.hospital_id,
              name: ward.name,
              created_at: ward.created_at,
              updated_at: ward.updated_at || ward.udpated_at
            })
          })
        }
      })

      // 모든 병실 리스트 추출 (flat)
      const roomsData: Room[] = []
      hierarchyData.forEach((hospital: any) => {
        if (hospital.wards && hospital.wards.length > 0) {
          hospital.wards.forEach((ward: any) => {
            if (ward.rooms && ward.rooms.length > 0) {
              ward.rooms.forEach((room: any) => {
                roomsData.push({
                  id: room.id,
                  ward_id: room.ward_id,
                  room_number: room.name,
                  bed_count: room.bed_count,
                  created_at: room.created_at,
                  updated_at: room.updated_at
                })
              })
            }
          })
        }
      })

      setHospitals(hospitalsData)
      setWards(wardsData)
      setRooms(roomsData)

      // console.log('GlobalContext - hospitals:', hospitalsData)
      // console.log('GlobalContext - wards:', wardsData)
      // console.log('GlobalContext - rooms:', roomsData)
    } catch (error) {
      // console.error('Failed to load hospital hierarchy:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadHospitals = async () => {
    await loadHospitalHierarchy()
  }

  const loadWards = async (hospitalId?: string) => {
    await loadHospitalHierarchy()
  }

  const loadRooms = async (wardId?: string) => {
    await loadHospitalHierarchy()
  }

  return (
    <GlobalContext.Provider
      value={{
        hospitals,
        wards,
        rooms,
        loadHospitals,
        loadWards,
        loadRooms,
        isLoading
      }}
    >
      {children}
    </GlobalContext.Provider>
  )
}