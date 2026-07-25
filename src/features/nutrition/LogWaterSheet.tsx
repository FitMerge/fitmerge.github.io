import Sheet from '../../components/Sheet'
import WaterLogger from './WaterLogger'

type LogWaterSheetProps = {
  open: boolean
  onClose: () => void
  date: string
}

export default function LogWaterSheet({ open, onClose, date }: LogWaterSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Log water">
      <WaterLogger date={date} onDone={onClose} />
    </Sheet>
  )
}
