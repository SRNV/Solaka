FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["GameServer/GameServer.csproj", "GameServer/"]
RUN dotnet restore "GameServer/GameServer.csproj"
COPY . .
WORKDIR "/src/GameServer"
RUN dotnet build "GameServer.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "GameServer.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=publish /app/publish .

ENV ASPNETCORE_URLS=http://+:5000
ENV BIBLE_PATH=/app/data/bible.json
EXPOSE 5000

ENTRYPOINT ["dotnet", "GameServer.dll"]
