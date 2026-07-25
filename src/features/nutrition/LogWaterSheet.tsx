import Sheet from '../../components/Sheet'
import Button from '../../components/Button'
import WaterLogger from './WaterLogger'

type LogWaterSheetProps = {
  open: boolean
  onClose: () => void
  date: string
}

export default function LogWaterSheet({ open, onClose, date }: LogWaterSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Log water">
      <WaterLogger date={date} />
      {/* Changes are saved as you go; this just closes the sheet. */}
      <Button variant="primary" full className="mt-4" onClick={onClose}>
        Done
      </Button>
    </Sheet>
  )
}
