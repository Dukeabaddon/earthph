# 🌏 EarthPH - Philippines Earthquake Monitor

> Real-time earthquake monitoring dashboard for the Philippines using PHIVOLCS data

[![Live Demo](https://img.shields.io/badge/demo-live-success)](https://your-app.vercel.app)
[![React](https://img.shields.io/badge/react-18.x-blue)](https://reactjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/tailwindcss-3.x-38bdf8)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## � About

**EarthPH** is a real-time earthquake monitoring web application that visualizes seismic activity across the Philippines. The application displays earthquake events on an interactive map with automatic updates every 60 seconds, providing citizens with up-to-date information about seismic activity in their region.

![EarthPH Screenshot](docs/images/screenshot.png)
*Interactive map showing recent earthquake activity across the Philippines*

---

## ✨ Features

### Live Earthquake Monitoring
- 🗺️ **Interactive Map** - Visual representation of earthquake locations using Leaflet.js
- 🔄 **Auto-Refresh** - Data updates every 60 seconds automatically
- 📍 **Precise Location** - Geographic coordinates and descriptive location names
- 📊 **Magnitude Display** - Visual indicators based on earthquake intensity
- ⏱️ **Recent Events** - Highlights earthquakes from the past 5 minutes with blinking indicators

### Event Details
Click any earthquake marker to view:
- 📅 **Date & Time** - When the earthquake occurred (Philippine Standard Time)
- 🌐 **Coordinates** - Exact latitude and longitude
- 📏 **Depth** - Distance below the Earth's surface (in kilometers)
- 💪 **Magnitude** - Richter scale measurement
- 📌 **Location** - Human-readable location description
- ⚡ **Intensity** - PHIVOLCS Earthquake Intensity Scale rating (when available)

### Data Management
- ⏳ **24-Hour Retention** - Displays earthquakes from the last 24 hours
- 🔒 **Reliable Data** - Information sourced directly from PHIVOLCS
- ⚡ **Fast Performance** - Optimized caching and CDN delivery

---

## 🛠️ Technology

Built with modern web technologies for optimal performance:

- **[React](https://reactjs.org/)** 18.x - UI framework
- **[Tailwind CSS](https://tailwindcss.com/)** v4 - Styling
- **[Leaflet.js](https://leafletjs.com/)** - Interactive maps
- **[Vercel](https://vercel.com/)** - Serverless deployment
- **[Supabase](https://supabase.com/)** - PostgreSQL database

---

## 📊 Data Source

All earthquake data is provided by the **Philippine Institute of Volcanology and Seismology (PHIVOLCS)**, a service agency of the Department of Science and Technology (DOST).

**Data Source**: [PHIVOLCS Earthquake Information](https://earthquake.phivolcs.dost.gov.ph/)

**Attribution**: All earthquake data is the property of PHIVOLCS/DOST. This application is for educational and public information purposes only.

**Data Updates**: The system retrieves the latest earthquake information and updates the database every 5 minutes to ensure accuracy while being respectful of PHIVOLCS infrastructure.

---

## 🌐 Live Application

**Access EarthPH**: [https://your-app.vercel.app](https://your-app.vercel.app)

*Note: The live URL will be updated after deployment*

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

### Usage Terms
- ✅ Free to use for personal and educational purposes
- ✅ Data attribution to PHIVOLCS is required
- ✅ Modifications and derivatives allowed under MIT License
- ⚠️ Commercial use should verify compliance with PHIVOLCS terms

---

## 🙏 Acknowledgments

- **[PHIVOLCS](https://phivolcs.dost.gov.ph/)** - For providing public earthquake data
- **[Leaflet.js](https://leafletjs.com/)** - Open-source mapping library
- **[OpenStreetMap](https://www.openstreetmap.org/)** - Map tile providers
- **Philippines DOST** - Department of Science and Technology

---

## 📞 Support

For questions, issues, or feedback:

- 📧 **Email**: support@earthph.app *(update with your contact)*
- 🐛 **Issues**: [GitHub Issues](https://github.com/yourusername/earthph/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/yourusername/earthph/discussions)

---

## 🚀 Status

**Current Version**: 1.0.0  
**Status**: ✅ Active & Maintained  
**Last Updated**: November 2025

---

**Built with ❤️ for the safety and awareness of Filipino citizens**
