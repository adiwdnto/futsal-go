import { useEffect } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';

function MapFocus({ field }) {
  const map = useMap();
  useEffect(() => {
    if (field && Number.isFinite(Number(field.latitude)) && Number.isFinite(Number(field.longitude))) {
      map.flyTo([Number(field.latitude), Number(field.longitude)], 15, { duration: 0.6 });
    }
  }, [field, map]);
  return null;
}

export default function MapView({ fields, selected, onSelect }) {
  return (
    <MapContainer center={[-2.13, 106.11]} zoom={12} scrollWheelZoom className="map-frame">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapFocus field={selected} />
      {fields.map((field) => (
        <Marker
          key={field.field_id}
          position={[Number(field.latitude), Number(field.longitude)]}
          eventHandlers={{ click: () => onSelect(field) }}
        >
          <Popup>
            <strong>{field.field_name}</strong>
            <br />
            {field.address}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
